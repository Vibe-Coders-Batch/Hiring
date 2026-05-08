FROM 763104351884.dkr.ecr.ap-south-1.amazonaws.com/pytorch-training:2.4.0-gpu-py311-cu124-ubuntu22.04-sagemaker

WORKDIR /opt/ml/code
COPY pyproject.toml ./
COPY models/ner ./models/ner

RUN pip install --no-cache-dir uv && uv pip install --system .

ENV SAGEMAKER_PROGRAM=models/ner/train.py
