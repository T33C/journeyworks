import os
import time
import logging
from typing import List, Dict, Any
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer, CrossEncoder
from transformers import AutoTokenizer, AutoModelForMaskedLM  # For SPLADE

# --- Configuration ---

# Determine the best available device: MPS (Apple Silicon) > CUDA > CPU
if torch.backends.mps.is_available() and torch.backends.mps.is_built():
    DEVICE = "mps"
    print("MPS (Apple Silicon GPU) backend is available and built.")
elif torch.cuda.is_available():
    DEVICE = "cuda"
    print("CUDA backend is available.")
else:
    DEVICE = "cpu"
    print("MPS and CUDA not available, using CPU.")

print(f"Selected device: {DEVICE}")


# Specify the models - consider making these environment variables
DENSE_MODEL_NAME = (
    "BAAI/bge-base-en-v1.5"  # Or 'sentence-transformers/all-mpnet-base-v2'
)
SPARSE_MODEL_NAME = (
    "naver/splade-cocondenser-ensembledistil"  # State-of-the-art learned sparse model
)
RERANKER_MODEL_NAME = (
    "BAAI/bge-reranker-base"  # Or 'cross-encoder/ms-marco-MiniLM-L-6-v2'
)

RERANKER_MAX_LENGTH = 512  # Max sequence length for cross-encoder
# Optional: Define default batch sizes if needed, although SentenceTransformer handles dynamic batching well
# DENSE_BATCH_SIZE = 32

# --- Model Loading ---
# Use a dictionary to hold models, loaded during startup
models = {}


def load_models():
    """Loads all models into the 'models' dictionary."""
    print("Loading models...")
    start_time = time.time()

    # Load Dense Embedding Model
    print(f"Loading dense model: {DENSE_MODEL_NAME} onto device: {DEVICE}")
    # SentenceTransformer handles device placement during initialization
    models["dense_model"] = SentenceTransformer(DENSE_MODEL_NAME, device=DEVICE)
    print(f"Dense model loaded. Time: {time.time() - start_time:.2f}s")
    current_time = time.time()

    # Load Sparse Embedding Model (SPLADE)
    print(f"Loading sparse model: {SPARSE_MODEL_NAME} onto device: {DEVICE}")
    models["sparse_tokenizer"] = AutoTokenizer.from_pretrained(SPARSE_MODEL_NAME)
    models["sparse_model"] = AutoModelForMaskedLM.from_pretrained(SPARSE_MODEL_NAME)
    # Explicitly move model to the selected device
    models["sparse_model"].to(DEVICE)
    models["sparse_model"].eval()  # Set to evaluation mode
    print(f"Sparse model loaded. Time: {time.time() - current_time:.2f}s")
    current_time = time.time()

    # Load Re-ranker Model
    print(f"Loading re-ranker model: {RERANKER_MODEL_NAME} onto device: {DEVICE}")
    # CrossEncoder also handles device placement during initialization
    models["reranker_model"] = CrossEncoder(
        RERANKER_MODEL_NAME, max_length=RERANKER_MAX_LENGTH, device=DEVICE
    )
    print(f"Re-ranker model loaded. Time: {time.time() - current_time:.2f}s")

    print(f"All models loaded. Total time: {time.time() - start_time:.2f}s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load models on startup
    load_models()
    yield
    # Clean up models if needed (optional)
    models.clear()


# --- FastAPI App ---
app = FastAPI(lifespan=lifespan)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Pydantic Models for Request/Response ---
class TextInput(BaseModel):
    text: str


class BatchTextInput(BaseModel):
    texts: List[str] = Field(..., min_items=1)  # Ensure at least one text is provided


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    model: str
    device_used: str


class BatchEmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    device_used: str


class SparseEmbeddingResponse(BaseModel):
    sparse_vector: Dict[str, float]  # { term: weight }
    model: str
    device_used: str


class BatchSparseEmbeddingResponse(BaseModel):
    sparse_vectors: List[Dict[str, float]]  # List of { term: weight } dicts
    model: str
    device_used: str


class DocumentInput(BaseModel):
    id: str | int  # Optional ID to track documents
    text: str


class RerankRequest(BaseModel):
    query: str
    documents: List[DocumentInput]
    top_n: int = Field(20, description="Number of documents to return after re-ranking")


class ScoredDocument(BaseModel):
    id: str | int
    text: str
    score: float


class RerankResponse(BaseModel):
    reranked_documents: List[ScoredDocument]
    model: str
    device_used: str


# --- Endpoints ---
@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "ok",
        "models_loaded": list(models.keys()),
        "compute_device": DEVICE,
    }


@app.post("/embed/dense", response_model=EmbeddingResponse)
async def get_dense_embedding(payload: TextInput):
    """Generates a dense embedding for a single input text."""
    logger.info(
        f"Received single dense embedding request for text: {payload.text[:80]}..."
    )
    model = models.get("dense_model")
    if not model:
        raise HTTPException(status_code=503, detail="Dense model not loaded")

    try:
        start_time = time.time()
        # BGE models recommend normalize_embeddings=True.
        embedding = model.encode(
            payload.text, convert_to_tensor=False, normalize_embeddings=True
        ).tolist()  # Return as list
        duration = time.time() - start_time
        logger.info(f"Dense embedding generated on {DEVICE} in {duration:.4f} seconds.")
        return EmbeddingResponse(
            embedding=embedding, model=DENSE_MODEL_NAME, device_used=DEVICE
        )
    except Exception as e:
        logger.error(f"Error generating dense embedding: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating dense embedding")


@app.post("/embed/dense/batch", response_model=BatchEmbeddingResponse)
async def get_dense_embedding_batch(payload: BatchTextInput):
    """Generates dense embeddings for a batch of input texts."""
    logger.info(
        f"Received batch dense embedding request for {len(payload.texts)} texts."
    )
    model = models.get("dense_model")
    if not model:
        raise HTTPException(status_code=503, detail="Dense model not loaded")

    try:
        start_time = time.time()
        # SentenceTransformer's encode method directly handles lists (batches)
        embeddings = model.encode(
            payload.texts,
            convert_to_tensor=False,
            normalize_embeddings=True,
            # batch_size=DENSE_BATCH_SIZE # Optional: can specify batch size for internal processing
        ).tolist()  # Ensure output is list of lists
        duration = time.time() - start_time
        logger.info(
            f"Batch of {len(payload.texts)} dense embeddings generated on {DEVICE} in {duration:.4f} seconds."
        )
        return BatchEmbeddingResponse(
            embeddings=embeddings, model=DENSE_MODEL_NAME, device_used=DEVICE
        )
    except Exception as e:
        logger.error(f"Error generating batch dense embeddings: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail="Error generating batch dense embeddings"
        )


@app.post("/embed/sparse", response_model=SparseEmbeddingResponse)
async def get_sparse_embedding(payload: TextInput):
    """Generates a learned sparse embedding (SPLADE) for a single input text."""
    logger.info(
        f"Received single sparse embedding request for text: {payload.text[:80]}..."
    )
    tokenizer = models.get("sparse_tokenizer")
    model = models.get("sparse_model")
    if not tokenizer or not model:
        raise HTTPException(
            status_code=503, detail="Sparse model or tokenizer not loaded"
        )

    try:
        start_time = time.time()
        # Ensure tensors are sent to the correct device
        tokens = tokenizer(payload.text, return_tensors="pt", truncation=True).to(
            DEVICE
        )

        with torch.no_grad():  # Ensure no gradients are computed
            output = model(**tokens)
            vec = torch.log(
                1 + torch.relu(output.logits)
            ) * tokens.attention_mask.unsqueeze(-1)
            vec = torch.max(vec, dim=1)[0].squeeze()

        # Ensure indices/weights are moved to CPU for list conversion/dict creation
        indices = vec.nonzero().squeeze().cpu().tolist()
        if isinstance(indices, int):
            indices = [indices]  # Handle scalar case
        weights = vec[indices].cpu().tolist()
        if isinstance(weights, float):
            weights = [weights]  # Handle scalar case

        vocab = tokenizer.get_vocab()
        id_to_token = {idx: token for token, idx in vocab.items()}
        sparse_dict = {
            id_to_token.get(idx, f"UNK_{idx}"): weight
            for idx, weight in zip(indices, weights)
            if weight > 0
        }

        duration = time.time() - start_time
        logger.info(
            f"Sparse embedding generated on {DEVICE} with {len(sparse_dict)} non-zero elements in {duration:.4f} seconds."
        )
        return SparseEmbeddingResponse(
            sparse_vector=sparse_dict, model=SPARSE_MODEL_NAME, device_used=DEVICE
        )
    except Exception as e:
        logger.error(f"Error generating sparse embedding: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating sparse embedding")


@app.post("/embed/sparse/batch", response_model=BatchSparseEmbeddingResponse)
async def get_sparse_embedding_batch(payload: BatchTextInput):
    """Generates learned sparse embeddings (SPLADE) for a batch of input texts."""
    logger.info(
        f"Received batch sparse embedding request for {len(payload.texts)} texts."
    )
    tokenizer = models.get("sparse_tokenizer")
    model = models.get("sparse_model")
    if not tokenizer or not model:
        raise HTTPException(
            status_code=503, detail="Sparse model or tokenizer not loaded"
        )

    try:
        start_time = time.time()
        # Tokenize the batch - padding=True is essential here!
        tokens = tokenizer(
            payload.texts, return_tensors="pt", truncation=True, padding=True
        ).to(DEVICE)

        with torch.no_grad():  # Ensure no gradients are computed
            output = model(**tokens)
            # Apply SPLADE logic (log(1 + relu)) element-wise across the batch
            # Shape: [batch_size, seq_len, vocab_size]
            vecs = torch.log(
                1 + torch.relu(output.logits)
            ) * tokens.attention_mask.unsqueeze(-1)
            # Max pooling over sequence length dimension for each item in the batch
            # Shape: [batch_size, vocab_size]
            vecs, _ = torch.max(vecs, dim=1)

        # Process each vector in the batch
        batch_results = []
        vocab = tokenizer.get_vocab()
        id_to_token = {idx: token for token, idx in vocab.items()}

        vecs_cpu = vecs.cpu()  # Move the whole batch result to CPU once
        for i in range(vecs_cpu.shape[0]):  # Iterate through batch items
            item_vec = vecs_cpu[i]
            indices = item_vec.nonzero().squeeze().tolist()
            if isinstance(indices, int):
                indices = [indices]  # Handle scalar case

            if not indices:  # Handle case with no non-zero elements
                sparse_dict = {}
            else:
                weights = item_vec[indices].tolist()
                if isinstance(weights, float):
                    weights = [weights]  # Handle scalar case
                sparse_dict = {
                    id_to_token.get(idx, f"UNK_{idx}"): weight
                    for idx, weight in zip(indices, weights)
                    if weight > 0
                }

            batch_results.append(sparse_dict)

        duration = time.time() - start_time
        logger.info(
            f"Batch of {len(payload.texts)} sparse embeddings generated on {DEVICE} in {duration:.4f} seconds."
        )
        return BatchSparseEmbeddingResponse(
            sparse_vectors=batch_results, model=SPARSE_MODEL_NAME, device_used=DEVICE
        )
    except Exception as e:
        logger.error(f"Error generating batch sparse embeddings: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail="Error generating batch sparse embeddings"
        )


@app.post("/rerank", response_model=RerankResponse)
async def rerank_documents(payload: RerankRequest):
    """Re-ranks documents based on relevance to the query using a cross-encoder."""
    logger.info(
        f"Received rerank request for query: '{payload.query[:80]}...' with {len(payload.documents)} documents."
    )
    model = models.get("reranker_model")
    if not model:
        raise HTTPException(status_code=503, detail="Re-ranker model not loaded")

    try:
        start_time = time.time()
        pairs = [(payload.query, doc.text) for doc in payload.documents]

        if not pairs:
            return RerankResponse(
                reranked_documents=[], model=RERANKER_MODEL_NAME, device_used=DEVICE
            )

        # Predict scores - CrossEncoder handles device placement internally via its init device arg
        # It also handles batching internally if the list of pairs is large
        scores = model.predict(pairs, show_progress_bar=False, convert_to_numpy=True)

        scored_docs = []
        for i, doc in enumerate(payload.documents):
            scored_docs.append(
                ScoredDocument(id=doc.id, text=doc.text, score=float(scores[i]))
            )

        reranked_docs = sorted(scored_docs, key=lambda x: x.score, reverse=True)
        final_docs = reranked_docs[: payload.top_n]
        duration = time.time() - start_time
        logger.info(
            f"Re-ranking completed on {DEVICE} in {duration:.4f} seconds. Returning {len(final_docs)} documents."
        )

        return RerankResponse(
            reranked_documents=final_docs, model=RERANKER_MODEL_NAME, device_used=DEVICE
        )
    except Exception as e:
        logger.error(f"Error during re-ranking: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error during re-ranking")


# --- Run with Uvicorn (for local testing directly on host) ---
if __name__ == "__main__":
    import uvicorn

    # This block is useful for running `python main.py` directly on macOS/Linux
    # The Dockerfile uses CMD ["uvicorn", ...] instead
    print(f"Starting Uvicorn server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
