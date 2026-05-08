# Generic training container, used when a per-model Dockerfile isn't needed.
# Push to ECR repo `vaivammhire-ml-<env>` (created in vaivammhire-infra/lib/ai-stack.ts).

FROM 763104351884.dkr.ecr.ap-south-1.amazonaws.com/pytorch-training:2.4.0-gpu-py311-cu124-ubuntu22.04-sagemaker

WORKDIR /opt/ml/code
COPY pyproject.toml ./
COPY models ./models
COPY eval ./eval

RUN pip install --no-cache-dir uv && uv pip install --system .

# SageMaker passes SAGEMAKER_PROGRAM at training time per estimator config.
