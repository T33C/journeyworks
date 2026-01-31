from llama_cpp import Llama
import logging
logging.getLogger().setLevel(logging.WARNING)
llama = Llama(model_path='models/mistral-7b-instruct-v0.2.Q5_K_M.gguf', verbose=False, n_ctx=3276, n_threads=8, n_gpus=35,            n_gpu_layers=999)
response = llama("Generate 20 very happy tweets regarding HSBC's announcement of its ISA interest rate tracking the Bank Of England Rate. Please only provide the text. Do not respond with anything else.",
                 max_tokens=1000,
                 temperature=0.8)
print(response['choices'][0]['text'])

#"Generate 20 very happy tweets regarding HSBC's announcement of its ISA interest rate tracking the Bank Of England Rate. Please only provide the text. Do not respond with anything else."