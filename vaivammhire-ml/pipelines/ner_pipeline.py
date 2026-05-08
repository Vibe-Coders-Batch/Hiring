"""SageMaker Pipeline for M1 (Resume NER).

Steps: Preprocess → Train → Evaluate → Register.

Triggered by `.github/workflows/ml-train.yml` nightly when training_labels has
> 50 new rows since the last run (PRD §7.5).
"""

from __future__ import annotations

import argparse
import logging
import os

from sagemaker.pytorch import PyTorch
from sagemaker.workflow.parameters import ParameterInteger, ParameterString
from sagemaker.workflow.pipeline import Pipeline
from sagemaker.workflow.steps import TrainingStep
from sagemaker.workflow.model_step import ModelStep
from sagemaker.model import Model

logger = logging.getLogger(__name__)

REGION = os.environ.get("AWS_REGION", "ap-south-1")
ROLE = os.environ.get("SAGEMAKER_ROLE_ARN", "")
TRAIN_DATA = ParameterString(name="TrainDataS3", default_value="s3://vaivammhire-training-dev/ner/train/")
INSTANCE_TYPE = ParameterString(name="InstanceType", default_value="ml.g5.xlarge")
EPOCHS = ParameterInteger(name="Epochs", default_value=3)


def build_pipeline() -> Pipeline:
    estimator = PyTorch(
        entry_point="train.py",
        source_dir="models/ner",
        role=ROLE,
        instance_type=INSTANCE_TYPE,
        instance_count=1,
        framework_version="2.4",
        py_version="py311",
        hyperparameters={"epochs": EPOCHS, "batch-size": 16, "lr": 2e-5},
    )

    train_step = TrainingStep(
        name="TrainNer",
        estimator=estimator,
        inputs={"train": TRAIN_DATA},
    )

    model = Model(
        image_uri=estimator.training_image_uri(),
        model_data=train_step.properties.ModelArtifacts.S3ModelArtifacts,
        role=ROLE,
    )
    register_step = ModelStep(
        name="RegisterNer",
        step_args=model.register(
            content_types=["application/json"],
            response_types=["application/json"],
            inference_instances=["ml.t2.medium"],
            transform_instances=["ml.m5.large"],
            model_package_group_name="vaivammhire-ner",
            approval_status="PendingManualApproval",
        ),
    )

    return Pipeline(
        name="vaivammhire-ner",
        parameters=[TRAIN_DATA, INSTANCE_TYPE, EPOCHS],
        steps=[train_step, register_step],
    )


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--execute", action="store_true", help="Submit a pipeline execution after upsert")
    args = p.parse_args()

    if not ROLE:
        raise SystemExit("SAGEMAKER_ROLE_ARN env var is required")

    pipeline = build_pipeline()
    pipeline.upsert(role_arn=ROLE)
    logger.info("Upserted pipeline %s", pipeline.name)

    if args.execute:
        execution = pipeline.start()
        logger.info("Started execution %s", execution.arn)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
