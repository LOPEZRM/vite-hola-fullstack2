# Backend – API de tareas

Proyecto independiente: DynamoDB + Lambda + API Gateway HTTP API. El state de Terraform es **local** (no se usa bucket S3).

## Estructura

- `main.tf` – Terraform (infra + empaquetado de la Lambda)
- `lambda/tasks-api/` – Código de la Lambda (Node 20, ES modules)
- `iam-terraform-backend-policy.json` – Política IAM mínima para el usuario que ejecuta Terraform (ver abajo).

---

## Permisos IAM para Terraform

El usuario (o rol) con el que te conectas a AWS para ejecutar `terraform apply` en este backend debe tener al menos los permisos definidos en **`iam-terraform-backend-policy.json`**.

Resumen por servicio:

| Servicio     | Uso en este backend |
|-------------|----------------------|
| **DynamoDB** | Crear/actualizar/eliminar tabla `tareas` |
| **IAM**      | Crear rol para la Lambda y política inline (PassRole para que Lambda asuma el rol) |
| **Lambda**   | Crear/actualizar función, permisos para API Gateway |
| **API Gateway (HTTP API)** | Crear API, integración, rutas y stage |

**Cómo aplicarlo:**

1. En IAM → Policies → Create policy → JSON → pega el contenido de `iam-terraform-backend-policy.json`.
2. Asigna esa política al usuario (o grupo) que uses para `aws configure` / credenciales de Terraform.

Alternativa rápida (más permisos de los estrictamente necesarios): adjuntar las políticas administradas `AmazonDynamoDBFullAccess`, `AWSLambda_FullAccess`, `AmazonAPIGatewayAdministrator` y una política que permita `iam:CreateRole`, `iam:PassRole`, `iam:PutRolePolicy`, etc. (p. ej. un custom policy solo con IAM para roles que use este proyecto).

---

## Autodespliegue con GitHub Actions

Cada **push a la rama `main`** que toque algo en `backend/` dispara el workflow **Deploy Backend**, que hace `terraform apply` y actualiza la Lambda y la API en AWS.

### Requisitos previos (una vez)

Configurar secretos en el repo de GitHub (Settings → Secrets and variables → Actions):

- `AWS_ACCESS_KEY_ID` – acceso de un usuario IAM con permisos para Lambda, API Gateway, DynamoDB e IAM.
- `AWS_SECRET_ACCESS_KEY` – clave secreta de ese usuario.

(No hace falta crear bucket S3 ni `TF_STATE_BUCKET`.)  
Nota: en CI el state queda en el runner y se pierde al terminar el job; para persistir state entre ejecuciones se puede configurar un backend S3 en otra clase.

---

## Despliegue manual (local)

1. Instalar dependencias de la Lambda:
   ```bash
   cd lambda/tasks-api
   npm install
   cd ../..
   ```

2. Inicializar y aplicar Terraform:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

La URL de la API queda en `terraform output api_url`. Pásala al **frontend** como variable `api_url` al hacer `terraform apply` del frontend.

---

## Actualizar la Lambda

- **Con CI:** haz push a `main` con los cambios en `backend/`; el workflow desplegará solo.
- **Manual:** tras cambiar código en `lambda/tasks-api/`, ejecuta en esta carpeta:
  ```bash
  terraform apply
  ```
