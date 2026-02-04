# Sentinel Model Service

A microservice providing access to various Hugging Face models for text processing, including sparse embeddings, dense embeddings, and reranking capabilities.

## Features

- Sparse embeddings using prithivida/Splade_PP_en_v1
- Dense embeddings using BAAI/bge-base-en-v1.5
- Reranking using BAAI/bge-reranker-base
- Support for both single text and batch processing
- Automatic retry mechanism for error handling
- Docker support

## API Endpoints

### Sparse Embedding

- POST `/sparse-embedding`

  - Input: `{"text": "your text here"}`
  - Output: `{"embedding": [...]}`

- POST `/sparse-embedding/batch`
  - Input: `{"texts": ["text1", "text2", ...]}`
  - Output: `{"embeddings": [[...], [...], ...]}`

### Dense Embedding

- POST `/dense-embedding`

  - Input: `{"text": "your text here"}`
  - Output: `{"embedding": [...]}`

- POST `/dense-embedding/batch`
  - Input: `{"texts": ["text1", "text2", ...]}`
  - Output: `{"embeddings": [[...], [...], ...]}`

### Reranking

- POST `/rerank`
  - Input: `{"query": "your query", "documents": ["doc1", "doc2", ...]}`
  - Output: `{"scores": [score1, score2, ...]}`

## Setup

### Local Development

1. Create a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the service:

```bash
uvicorn app.main:app --reload
```

### Docker

1. Build the Docker image:

```bash
docker build -t sentinel-model-service .
```

2. Run the container:

```bash
docker run -p 8000:8000 sentinel-model-service
```

## API Documentation

Once the service is running, you can access the interactive API documentation at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Error Handling

The service includes a retry mechanism that will attempt to process requests up to 5 times before returning an error. The retry attempts use exponential backoff with a minimum wait time of 4 seconds and a maximum of 10 seconds between attempts.
