import os
import sys
import json
import hashlib
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Asegurar que la ruta base esté en sys.path para importar visual_memory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import visual_memory
from qdrant_client.models import Distance, VectorParams, PointStruct, PayloadSchemaType

COLLECTION_NAME = "past_stories"
VECTOR_SIZE = 768

def migrate():
    # 1. Cargar las historias desde past_stories_db.json
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "past_stories_db.json")
    if not os.path.exists(db_path):
        print(f"❌ No se encontró el archivo {db_path}")
        return

    with open(db_path, "r", encoding="utf-8") as f:
        stories = json.load(f)
    
    if not stories:
        print("ℹ️ El archivo de historias está vacío.")
        return

    print(f"📋 Encontradas {len(stories)} historias para migrar.")

    # 2. Conectar a Qdrant y crear la colección si no existe
    client = visual_memory._get_qdrant()
    if not client:
        print("❌ No se pudo conectar a Qdrant. Asegúrate de que el contenedor de Qdrant esté corriendo.")
        return

    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        client.create_payload_index(COLLECTION_NAME, "key", PayloadSchemaType.KEYWORD)
        print(f"✅ Colección '{COLLECTION_NAME}' creada en Qdrant.")
    else:
        print(f"ℹ️ La colección '{COLLECTION_NAME}' ya existe.")

    # Precargar el modelo CLIP
    visual_memory._load_clip()

    # 3. Iterar, generar embeddings y hacer upsert
    points = []
    for s in stories:
        key = s.get("key", "Unknown")
        summary = s.get("summary", "")
        description = s.get("description", "")
        solution = s.get("solution", "")
        lessons = s.get("lessons", "")

        # Crear el texto representativo para el embedding
        text_to_embed = f"Summary: {summary}\nDescription: {description}\nSolution: {solution}\nLessons: {lessons}"
        
        print(f"🧠 Generando embedding para {key}: {summary[:40]}...")
        vector = visual_memory.embed_text(text_to_embed)
        if not vector:
            print(f"❌ Error al generar embedding para {key}. Saltando...")
            continue

        point_id = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
        
        payload = {
            "key": key,
            "summary": summary,
            "description": description,
            "solution": solution,
            "lessons": lessons,
            "indexed_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        points.append(PointStruct(id=point_id, vector=vector, payload=payload))

    if points:
        print(f"📥 Insertando {len(points)} puntos en Qdrant...")
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        print("✅ Migración completada con éxito.")
    else:
        print("⚠️ No se generaron puntos para insertar.")

if __name__ == "__main__":
    migrate()
