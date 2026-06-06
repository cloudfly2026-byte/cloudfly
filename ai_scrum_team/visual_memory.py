"""
visual_memory.py
────────────────
Pipeline RAG visual para el AI Scrum Team de CloudFly.

Flujo:
  Imagen  →  CLIP ViT-L/14 (GTX 1650 CUDA)  →  embedding 768 dims  →  Qdrant "visual_bugs"

Instalación (PowerShell, una sola vez):
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
    pip install transformers qdrant-client Pillow einops

Qdrant corre en localhost:6333 (docker-compose-full-vps.yml).
"""

import os
import sys
import time
import base64
import hashlib
import threading
from io import BytesIO
from pathlib import Path
from typing import Optional, List, Dict, Any

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

QDRANT_HOST     = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT     = int(os.getenv("QDRANT_PORT", "6333"))
COLLECTION_NAME = "visual_bugs"
VECTOR_SIZE     = 768
CLIP_MODEL_ID   = "openai/clip-vit-large-patch14"

# ── Singleton CLIP ────────────────────────────────────────────────────
_clip_model     = None
_clip_processor = None
_clip_lock      = threading.Lock()
_clip_loaded    = False


def _load_clip() -> bool:
    global _clip_model, _clip_processor, _clip_loaded
    with _clip_lock:
        if _clip_loaded:
            return True
        try:
            import torch
            from transformers import CLIPModel, CLIPProcessor, logging as transformers_logging
            transformers_logging.set_verbosity_error()

            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype  = torch.float16 if device == "cuda" else torch.float32

            print(f"\n🔭 [Visual Memory]: Cargando CLIP ViT-L/14 en {device.upper()}...")
            t0 = time.time()

            _clip_processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)
            _clip_model = CLIPModel.from_pretrained(
                CLIP_MODEL_ID, torch_dtype=dtype,
            ).to(device)
            _clip_model.eval()

            elapsed = round(time.time() - t0, 1)
            vram = ""
            if device == "cuda":
                used = torch.cuda.memory_allocated() / 1024**2
                vram = f" | VRAM: {used:.0f} MB"
            print(f"✅ [Visual Memory]: CLIP listo en {elapsed}s{vram}")
            _clip_loaded = True
            return True

        except ImportError as e:
            print(f"❌ [Visual Memory]: Dependencia faltante — {e}")
            print("   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")
            print("   pip install transformers qdrant-client einops")
            return False
        except Exception as e:
            print(f"❌ [Visual Memory]: Error cargando CLIP — {e}")
            return False


# ── Singleton Qdrant ──────────────────────────────────────────────────
_qdrant_client = None
_qdrant_lock   = threading.Lock()


def _get_qdrant():
    global _qdrant_client
    with _qdrant_lock:
        if _qdrant_client is not None:
            return _qdrant_client
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import Distance, VectorParams, PayloadSchemaType

            # Intentar primero con el host configurado
            try:
                client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, timeout=5)
                existing = [c.name for c in client.get_collections().collections]
                print(f"📡 [Visual Memory]: Conectado a Qdrant en {QDRANT_HOST}:{QDRANT_PORT}")
            except Exception as e:
                # Si falló y el host no era localhost, intentar fallback a localhost
                if QDRANT_HOST != "localhost":
                    print(f"⚠️  [Visual Memory]: Falló conexión a {QDRANT_HOST}:{QDRANT_PORT}. Intentando fallback a localhost...")
                    client = QdrantClient(host="localhost", port=QDRANT_PORT, timeout=5)
                    existing = [c.name for c in client.get_collections().collections]
                    print(f"📡 [Visual Memory]: Conectado a Qdrant en localhost:{QDRANT_PORT} (fallback)")
                else:
                    raise e

            if COLLECTION_NAME not in existing:
                client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
                )
                client.create_payload_index(COLLECTION_NAME, "issue_key", PayloadSchemaType.KEYWORD)
                client.create_payload_index(COLLECTION_NAME, "bug_type",  PayloadSchemaType.KEYWORD)
                client.create_payload_index(COLLECTION_NAME, "resolved",  PayloadSchemaType.BOOL)
                print(f"✅ [Visual Memory]: Colección '{COLLECTION_NAME}' creada en Qdrant.")
            else:
                print(f"✅ [Visual Memory]: Colección '{COLLECTION_NAME}' ya existe en Qdrant.")

            _qdrant_client = client
            return client
        except Exception as e:
            print(f"❌ [Visual Memory]: No se pudo conectar a Qdrant ({QDRANT_HOST}:{QDRANT_PORT}) — {e}")
            return None


# ── Helpers ───────────────────────────────────────────────────────────

def _load_image(source: str):
    from PIL import Image
    # Base64
    if source.startswith("data:image") or (
        len(source) > 200 and " " not in source
        and "\\" not in source and "/" not in source
    ):
        if "," in source:
            source = source.split(",", 1)[1]
        return Image.open(BytesIO(base64.b64decode(source))).convert("RGB")
    # Ruta de archivo
    path = Path(source)
    if not path.is_absolute():
        path = Path(r"C:\apps\cloudfly") / path
    if not path.exists():
        raise FileNotFoundError(f"Imagen no encontrada: {path}")
    return Image.open(path).convert("RGB")


# ── API pública ───────────────────────────────────────────────────────

def embed_image(image_source: str) -> Optional[List[float]]:
    """Genera embedding CLIP (768 dims) de una imagen."""
    if not _load_clip():
        return None
    try:
        import torch
        img    = _load_image(image_source)
        device = next(_clip_model.parameters()).device
        inputs = _clip_processor(images=img, return_tensors="pt").to(device)
        with torch.no_grad():
            feat = _clip_model.get_image_features(**inputs)
            if hasattr(feat, "pooler_output") and feat.pooler_output is not None:
                feat = feat.pooler_output
            elif hasattr(feat, "last_hidden_state") and feat.last_hidden_state is not None:
                feat = feat.last_hidden_state[:, 0, :]
            elif isinstance(feat, (list, tuple)):
                feat = feat[0]
            feat = feat / feat.norm(dim=-1, keepdim=True)
        return feat[0].cpu().float().tolist()
    except Exception as e:
        print(f"❌ [Visual Memory]: Error generando embedding imagen — {e}")
        return None


def embed_text(text: str) -> Optional[List[float]]:
    """Genera embedding CLIP de texto (mismo espacio vectorial que imágenes)."""
    if not _load_clip():
        return None
    try:
        import torch
        device = next(_clip_model.parameters()).device
        inputs = _clip_processor(text=[text], return_tensors="pt", padding=True, truncation=True).to(device)
        with torch.no_grad():
            feat = _clip_model.get_text_features(**inputs)
            if hasattr(feat, "pooler_output") and feat.pooler_output is not None:
                feat = feat.pooler_output
            elif hasattr(feat, "last_hidden_state") and feat.last_hidden_state is not None:
                feat = feat.last_hidden_state[:, 0, :]
            elif isinstance(feat, (list, tuple)):
                feat = feat[0]
            feat = feat / feat.norm(dim=-1, keepdim=True)
        return feat[0].cpu().float().tolist()
    except Exception as e:
        print(f"❌ [Visual Memory]: Error generando embedding texto — {e}")
        return None


def index_image(
    image_source: str,
    issue_key:    str,
    summary:      str = "",
    description:  str = "",
    solution:     str = "",
    bug_type:     str = "ui",
    resolved:     bool = False,
    extra_metadata: Dict[str, Any] = None,
) -> bool:
    """Indexa una imagen en Qdrant con metadata del ticket Jira."""
    from qdrant_client.models import PointStruct

    vector = embed_image(image_source)
    if vector is None:
        return False
    client = _get_qdrant()
    if client is None:
        return False

    try:
        img_hash = hashlib.md5(_load_image(image_source).tobytes()).hexdigest()
    except Exception:
        img_hash = hashlib.md5(issue_key.encode()).hexdigest()

    point_id = int(hashlib.md5(f"{issue_key}_{img_hash}".encode()).hexdigest()[:8], 16)
    payload  = {
        "issue_key":   issue_key,
        "summary":     summary,
        "description": description,
        "solution":    solution,
        "bug_type":    bug_type,
        "resolved":    resolved,
        "indexed_at":  time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    if extra_metadata:
        payload.update(extra_metadata)

    try:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[PointStruct(id=point_id, vector=vector, payload=payload)],
        )
        print(f"📌 [Visual Memory]: {issue_key} indexado (id={point_id}).")
        return True
    except Exception as e:
        print(f"❌ [Visual Memory]: Error upsert — {e}")
        return False


def search_similar_images(
    query_source:     str,
    top_k:            int   = 5,
    score_threshold:  float = 0.75,
    filter_resolved:  Optional[bool] = None,
    filter_bug_type:  Optional[str]  = None,
) -> List[Dict[str, Any]]:
    """Busca imágenes similares por imagen o texto descriptivo."""
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    ext     = Path(query_source).suffix.lower() if len(query_source) < 300 else ""
    is_text = ext not in (".png", ".jpg", ".jpeg", ".gif", ".bmp") and not query_source.startswith("data:")
    vector  = embed_text(query_source) if is_text else embed_image(query_source)
    if vector is None:
        return []

    client = _get_qdrant()
    if client is None:
        return []

    must = []
    if filter_resolved is not None:
        must.append(FieldCondition(key="resolved", match=MatchValue(value=filter_resolved)))
    if filter_bug_type:
        must.append(FieldCondition(key="bug_type",  match=MatchValue(value=filter_bug_type)))

    try:
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector,
            limit=top_k,
            score_threshold=score_threshold,
            query_filter=Filter(must=must) if must else None,
            with_payload=True,
        )
        return [
            {
                "issue_key":   (p := r.payload or {}).get("issue_key", "?"),
                "summary":     p.get("summary", ""),
                "description": p.get("description", ""),
                "solution":    p.get("solution", "No resuelta aún"),
                "resolved":    p.get("resolved", False),
                "bug_type":    p.get("bug_type", ""),
                "indexed_at":  p.get("indexed_at", ""),
                "score":       round(r.score, 4),
            }
            for r in (results.points if results else [])
        ]
    except Exception as e:
        print(f"❌ [Visual Memory]: Error búsqueda — {e}")
        return []


def format_search_results_for_agent(results: List[Dict]) -> str:
    if not results:
        return "No se encontraron bugs visuales similares en la memoria histórica."
    lines = ["## 🔍 Bugs Visuales Similares Encontrados en Memoria\n"]
    for i, r in enumerate(results, 1):
        status = "✅ Resuelto" if r["resolved"] else "⏳ Pendiente"
        lines.append(f"### {i}. [{r['issue_key']}] {r['summary']} — similitud: {r['score']:.0%}")
        lines.append(f"- **Estado**: {status} | **Tipo**: {r['bug_type']}")
        if r["description"]:
            lines.append(f"- **Descripción**: {r['description'][:200]}")
        if r["solution"] and r["solution"] != "No resuelta aún":
            lines.append(f"- **Solución aplicada**: {r['solution'][:300]}")
        lines.append(f"- **Indexado**: {r['indexed_at']}\n")
    return "\n".join(lines)


def mark_resolved(issue_key: str, solution: str) -> int:
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    client = _get_qdrant()
    if client is None:
        return 0
    try:
        client.set_payload(
            collection_name=COLLECTION_NAME,
            payload={"resolved": True, "solution": solution},
            points_selector=Filter(must=[FieldCondition(key="issue_key", match=MatchValue(value=issue_key))]),
        )
        print(f"✅ [Visual Memory]: {issue_key} marcado resuelto en Qdrant.")
        return 1
    except Exception as e:
        print(f"❌ [Visual Memory]: Error marcando resuelto — {e}")
        return 0


def collection_stats() -> str:
    client = _get_qdrant()
    if client is None:
        return "Qdrant no disponible."
    try:
        info = client.get_collection(COLLECTION_NAME)
        return (
            f"📊 Colección '{COLLECTION_NAME}': {info.points_count} imágenes indexadas | "
            f"Vector: {VECTOR_SIZE} dims | Distancia: Cosine"
        )
    except Exception as e:
        return f"Error stats: {e}"


def preload(background: bool = True):
    """Precarga CLIP + Qdrant al iniciar. Llamar desde main.py."""
    def _bg():
        _load_clip()
        _get_qdrant()
        print(f"🚀 [Visual Memory]: {collection_stats()}")
    if background:
        threading.Thread(target=_bg, daemon=True, name="VisualMemoryPreloader").start()
    else:
        _bg()


# ── CLI ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="Visual Memory CLI")
    sub = p.add_subparsers(dest="cmd")

    pi = sub.add_parser("index")
    pi.add_argument("image"); pi.add_argument("issue_key")
    pi.add_argument("--summary", default=""); pi.add_argument("--description", default="")
    pi.add_argument("--bug_type", default="ui")

    ps = sub.add_parser("search")
    ps.add_argument("query"); ps.add_argument("--top_k", type=int, default=5)
    ps.add_argument("--threshold", type=float, default=0.75)

    sub.add_parser("stats")
    args = p.parse_args()

    if args.cmd == "index":
        print("✅ Indexado." if index_image(args.image, args.issue_key, args.summary, args.description, bug_type=args.bug_type) else "❌ Falló.")
    elif args.cmd == "search":
        print(format_search_results_for_agent(search_similar_images(args.query, top_k=args.top_k, score_threshold=args.threshold)))
    elif args.cmd == "stats":
        preload(background=False); print(collection_stats())
    else:
        p.print_help()
