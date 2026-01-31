
import weaviate
from weaviate.connect import ConnectionParams
from weaviate.classes.config import Configure, Property, DataType
from sentence_transformers import SentenceTransformer



def main():
    with weaviate.WeaviateClient(
        connection_params=ConnectionParams.from_url("http://localhost:8080", grpc_port=50051)
    ) as client:
        client.connect()
        print("ready:", client.is_ready())
        # 1) Create collection (vectorizer none: we supply vectors)
        if client.collections.exists("CustomerFeedback"):
            client.collections.delete("CustomerFeedback")

        client.collections.create(
            name="CustomerFeedback",
            vectorizer_config=Configure.Vectorizer.none(),
            properties=[
                Property(name="text", data_type=DataType.TEXT),
                Property(name="source", data_type=DataType.TEXT),
                Property(name="sentiment", data_type=DataType.TEXT),
                Property(name="journey_stage", data_type=DataType.TEXT),
            ],
        )

        col = client.collections.get("CustomerFeedback")

        # 2) Embedder (free, local)
        embedder = SentenceTransformer("all-MiniLM-L6-v2")

        # 3) Insert some mock data
        mock_feedback = [
            {
                "text": "My delivery was three days late and nobody replied to my emails.",
                "source": "email",
                "sentiment": "negative",
                "journey_stage": "delivery",
            },
            {
                "text": "Support was brilliant — they fixed my login issue in five minutes.",
                "source": "phone",
                "sentiment": "positive",
                "journey_stage": "support",
            },
            {
                "text": "You increased the price without warning. I want to cancel.",
                "source": "chat",
                "sentiment": "negative",
                "journey_stage": "billing",
            },
        ]

        with col.batch.dynamic() as batch:
            for item in mock_feedback:
                vec = embedder.encode(item["text"]).tolist()
                batch.add_object(properties=item, vector=vec)

        # 4) Query semantically
        query = "I'm angry my order arrived late"
        qvec = embedder.encode(query).tolist()

        res = col.query.near_vector(
            near_vector=qvec,
            limit=3,
            return_properties=["text", "sentiment", "journey_stage", "source"],
        )

        print("\nTop matches:")
        for i, obj in enumerate(res.objects, start=1):
            props = obj.properties
            print(f"{i}. [{props['journey_stage']}/{props['sentiment']}] {props['text']}")

if __name__ == "__main__":
    main()