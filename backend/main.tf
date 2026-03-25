# =============================================================================
# Backend: API de tareas (DynamoDB + Lambda + API Gateway HTTP)
# =============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# 1. DECLARACIÓN DE VARIABLES (Deben estar afuera)
variable "aws_access_key" {}
variable "aws_secret_key" {}
variable "aws_region"     { default = "us-east-1" }

# Variables extra para evitar advertencias del .tfvars
variable "github_token"         { default = "" }
variable "repository"           { default = "" }
variable "branch_name"          { default = "" }
variable "app_root"             { default = "" }
variable "api_url"              { default = "" }
variable "cognito_user_pool_id" { default = "" }
variable "cognito_client_id"    { default = "" }

# 2. CONFIGURACIÓN DEL PROVEEDOR
provider "aws" {
  region     = var.aws_region
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

# ---------------------------------------------------------------------------
# DynamoDB
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "tareas" {
  name = "tareas-fullstack-v3"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

# ---------------------------------------------------------------------------
# Lambda
# ---------------------------------------------------------------------------
resource "aws_iam_role" "lambda_tasks" {
  name = "lambda-tasks-role-v3"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_tasks_dynamodb" {
  name = "dynamodb"
  role = aws_iam_role.lambda_tasks.id   # rol: se usa id (nombre del rol)

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Scan", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
        Resource = [aws_dynamodb_table.tareas.arn]   # políticas IAM piden ARN, no id
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "null_resource" "lambda_npm_install" {
  triggers = {
    package_json = filemd5("${path.module}/lambda/tasks-api/package.json")
    index        = filemd5("${path.module}/lambda/tasks-api/index.mjs")
  }
  provisioner "local-exec" {
    command = "cd ${path.module}/lambda/tasks-api && npm install"
  }
}

data "archive_file" "lambda_tasks" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/tasks-api"
  output_path = "${path.module}/lambda/tasks-api.zip"
  depends_on  = [null_resource.lambda_npm_install]
}

resource "aws_lambda_function" "tasks_api" {
  filename         = data.archive_file.lambda_tasks.output_path
  function_name = "tasks-api-v3"
  role             = aws_iam_role.lambda_tasks.arn   # Lambda exige ARN del rol, no id
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda_tasks.output_base64sha256
  runtime          = "nodejs20.x"

  environment {
    variables = { TABLE_NAME = aws_dynamodb_table.tareas.name }
  }
}

# ---------------------------------------------------------------------------
# API Gateway HTTP API
# ---------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "tasks" {
  name          = "tasks-api-hola-fullstack"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods  = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers  = ["Content-Type"]
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.tasks.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.tasks_api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.tasks.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "root" {
  api_id    = aws_apigatewayv2_api.tasks.id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Deployment explícito: sin esto el stage $default puede no tener las rutas activas (sobre todo con auto_deploy = false).
resource "aws_apigatewayv2_deployment" "tasks" {
  api_id = aws_apigatewayv2_api.tasks.id
  depends_on = [
    aws_apigatewayv2_route.proxy,
    aws_apigatewayv2_route.root,
  ]
}

resource "aws_apigatewayv2_stage" "default" {
  api_id        = aws_apigatewayv2_api.tasks.id
  name          = "$default"
  deployment_id = aws_apigatewayv2_deployment.tasks.id
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tasks_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.tasks.execution_arn}/*/*"
}

output "api_url" {
  description = "URL base de la API de tareas"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

# Crear el Pool de Usuarios
resource "aws_cognito_user_pool" "pool" {
  name = "task_user_pool"

  password_policy {
    minimum_length = 8
  }

  auto_verified_attributes = ["email"]
}

# Crear el Cliente de la Aplicación (necesario para el Frontend)
resource "aws_cognito_user_pool_client" "client" {
  name         = "task_app_client"
  user_pool_id = aws_cognito_user_pool.pool.id
  
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

# Output para usar en el Frontend
output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.pool.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.client.id
}
