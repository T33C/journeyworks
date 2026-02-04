FROM python:3.10-slim

LABEL name="Sentinel Model Service" \
    description="Python microservice for generating embeddings using Hugging Face models" \
    version="1.0" \
    maintainer="Sentinel Team"

WORKDIR /app
# Use an official Python runtime as a parent image
# Choose slim for smaller size. Adjust Python version if needed.
FROM python:3.10-slim

# Set environment variables
# Ensures Python prints output directly to terminal without buffering
ENV PYTHONUNBUFFERED 1
# Prevent transformers/torch from trying to use GPU if we intend CPU
ENV CUDA_VISIBLE_DEVICES=""
# Set Hugging Face cache directory (optional, but can map volume to it)
ENV HF_HOME="/huggingface_cache"

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if any are needed (unlikely for this setup)
# RUN apt-get update && apt-get install -y --no-install-recommends some-package && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# Use --no-cache-dir to reduce image size
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Define the command to run the application using Uvicorn
# The main.py is in the app/ directory, so we use app.main:app
# Use --host 0.0.0.0 to make it accessible externally
# Use --port 8000 to match the EXPOSE instruction
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
# For production consider more workers:
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]