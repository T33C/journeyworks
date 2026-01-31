from sentence_transformers import SentenceTransformer
from llama_cpp import Llama

llm = None
try:
    llm = Llama(
        model_path="models/mistral-7b-instruct-v0.2.Q5_K_M.gguf",
        n_ctx=2048,
        n_batch=64,
        verbose=False,
    )

    out = llm("[INST] Say hello in one sentence. [/INST]", max_tokens=50, stop=["</s>", "[INST]"])
    print(out["choices"][0]["text"])

finally:
    if llm is not None:
        llm.close()