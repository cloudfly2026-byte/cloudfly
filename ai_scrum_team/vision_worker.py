import os
import sys
import time
import base64
import requests
import threading

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


class VisionWorker:
    def __init__(self, env_path=None):
        self.api_key    = os.getenv("OPENROUTER_API_KEY")
        self.jira_url   = os.getenv("JIRA_API_URL")
        self.jira_email = os.getenv("JIRA_EMAIL")
        self.jira_token = os.getenv("JIRA_API_TOKEN")
        self._local_ok  = None  # None = no probado aún

    def _check_local(self) -> bool:
        if self._local_ok is not None:
            return self._local_ok
        try:
            import torch          # noqa
            import transformers   # noqa
            self._local_ok = True
            print("✅ [Vision Worker]: torch+transformers disponibles (CUDA).")
        except ImportError:
            self._local_ok = False
            print("⚠️  [Vision Worker]: torch/transformers no instalados — usando Gemini API.")
        return self._local_ok

    def encode_image_base64(self, path):
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def analyze_with_local_model(self, local_path: str, issue_key: str, filename: str) -> str:
        try:
            scrum_dir = os.path.dirname(os.path.abspath(__file__))
            if scrum_dir not in sys.path:
                sys.path.insert(0, scrum_dir)
            from local_vision_model import analyze_image
            question = (
                f"This image is attached to Jira issue {issue_key} (file: {filename}). "
                "Analyze it from a software developer perspective. Identify any UI errors, "
                "bug screenshots, design mockups, or technical diagrams. Describe exactly "
                "what a developer needs to do to implement or fix what is shown. "
                "Start your response with 'CLASSIFICATION: ASSET' if this is an image to be included "
                "in the application (such as a logo, background, banner, UI asset, etc.), or "
                "'CLASSIFICATION: INFORMATIVE' if it is just a screenshot of a bug or an informative graphic."
            )
            print(f"🔭 [Vision Worker - Local]: Analizando {filename} con moondream2...")
            return analyze_image(local_path, question)
        except Exception as e:
            return f"Error modelo local: {e}"

    def analyze_with_gemini_api(self, local_path: str, issue_key: str, filename: str) -> str:
        img_b64 = self.encode_image_base64(local_path)
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": "google/gemini-2.5-flash:free",
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": (
                        f"Analiza esta imagen adjunta al ticket Jira {issue_key} (archivo: {filename}). "
                        "Describe qué error técnico o diseño UI se observa y qué debe hacer el desarrollador. "
                        "Comienza tu respuesta con 'CLASSIFICATION: ASSET' si es una imagen/asset para incluir "
                        "en la aplicación (como logos, banners, fondos, etc.), o con 'CLASSIFICATION: INFORMATIVE' "
                        "si es solo una captura de pantalla informativa o reporte de error."
                    )},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                ]
            }]
        }
        print(f"☁️  [Vision Worker - API]: Enviando {filename} a Gemini 2.5 Flash...")
        res = requests.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=60)
        if res.status_code == 200:
            return res.json()['choices'][0]['message']['content']
        return f"Error Gemini API: HTTP {res.status_code} — {res.text[:200]}"

    def analyze_comment_image_async(self, issue_key, attachment_id, filename, content_url):
        threading.Thread(
            target=self._download_and_analyze_job,
            args=(issue_key, attachment_id, filename, content_url),
            daemon=True
        ).start()
        print(f"👁️  [Vision Worker]: Analizando adjunto '{filename}' en segundo plano...")

    def _download_and_analyze_job(self, issue_key, attachment_id, filename, content_url):
        try:
            # 1. Descargar imagen de Jira
            tmp_dir    = r"C:\apps\cloudfly\scratch"
            os.makedirs(tmp_dir, exist_ok=True)
            local_path = os.path.join(tmp_dir, f"jira_att_{attachment_id}_{filename}")

            headers = {}
            if self.jira_email and self.jira_token:
                auth_b64 = base64.b64encode(f"{self.jira_email}:{self.jira_token}".encode()).decode()
                headers["Authorization"] = f"Basic {auth_b64}"

            res = requests.get(content_url, headers=headers, timeout=30)
            if res.status_code != 200:
                print(f"❌ [Vision Worker]: No se pudo descargar {filename}. HTTP {res.status_code}")
                return

            with open(local_path, "wb") as f:
                f.write(res.content)
            print(f"📥 [Vision Worker]: {filename} descargado ({os.path.getsize(local_path)} bytes).")

            # 2. Analizar — local primero, API como fallback
            if self._check_local():
                description  = self.analyze_with_local_model(local_path, issue_key, filename)
                source_label = "moondream2 local (GTX 1650 CUDA)"
            else:
                description  = self.analyze_with_gemini_api(local_path, issue_key, filename)
                source_label = "Gemini 2.5 Flash API"

            print(f"📄 [Vision Worker - Reporte {filename}]:\n{description}")

            # Identificar clasificación
            is_asset = False
            desc_lower = description.lower()
            if "classification: asset" in desc_lower or "classification:asset" in desc_lower:
                is_asset = True

            dest_path = "N/A"
            if is_asset:
                uploads_dir = r"C:\apps\cloudfly\uploads"
                os.makedirs(uploads_dir, exist_ok=True)
                dest_path = os.path.join(uploads_dir, f"jira_att_{attachment_id}_{filename}")
                import shutil
                try:
                    shutil.copy2(local_path, dest_path)
                    print(f"💾 [Vision Worker]: Asset guardado permanentemente en {dest_path}")
                except Exception as ce:
                    print(f"❌ [Vision Worker]: Error al copiar asset a uploads — {ce}")

            # 3. Guardar en memoria Scrum (lessons_learned.md)
            lessons_path = r"C:\apps\cloudfly\ai_scrum_team\lessons_learned.md"
            timestamp    = time.strftime("%Y-%m-%d %H:%M:%S")
            entry = (
                f"\n\n## 👁️ Análisis Visual ({timestamp}) - {filename} [{issue_key}]\n"
                f"*   **Clasificación**: {'Asset de Aplicación (Guardado)' if is_asset else 'Captura de Pantalla / Informativa'}\n"
                f"*   **Fuente**: {source_label}\n"
                f"*   **Ubicación del Archivo**: {dest_path if is_asset else 'Temporal (Eliminado)'}\n"
                f"*   **Reporte**:\n\n{description}\n"
            )
            with open(lessons_path, "a", encoding="utf-8") as lf:
                lf.write(entry)
            print(f"🧠 [Vision Worker]: Análisis de '{filename}' guardado en memoria Scrum.")

            # 4. Indexar en memoria visual (CLIP + Qdrant) - Solo si es un ASSET de la aplicación
            if is_asset:
                try:
                    scrum_dir = os.path.dirname(os.path.abspath(__file__))
                    if scrum_dir not in sys.path:
                        sys.path.insert(0, scrum_dir)
                    from visual_memory import index_image
                    index_image(
                        image_source=local_path,
                        issue_key=issue_key,
                        summary=filename,
                        description=description[:500],
                        bug_type="asset",
                        resolved=False,
                    )
                    print(f"📌 [Vision Worker]: {filename} indexado en Qdrant visual memory.")
                except Exception as ve:
                    print(f"⚠️  [Vision Worker]: No se pudo indexar en Qdrant: {ve}")

            # Limpiar tmp
            try:
                os.remove(local_path)
            except Exception:
                pass

        except Exception as e:
            print(f"❌ [Vision Worker - Fallo]: {e}")
