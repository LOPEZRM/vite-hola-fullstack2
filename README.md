# Hola Fullstack – Lista de tareas

Proyecto dividido en **dos carpetas independientes**: backend y frontend, cada una con su propio Terraform.

## Estructura actual

```
hola-fullstack/
├── backend/          ← Proyecto backend (API + DynamoDB + Lambda)
│   ├── main.tf
│   ├── lambda/tasks-api/
│   └── README.md
├── frontend/        ← Proyecto frontend (React + Amplify)
│   ├── main.tf
│   ├── src/
│   ├── package.json
│   └── README.md
└── README.md        (este archivo)
```

## Orden de despliegue

1. **Backend** (primero, una vez o cuando cambies la API/Lambda):
   ```bash
   cd backend
   cd lambda/tasks-api && npm install && cd ../..
   terraform init
   terraform apply
   ```

2. **Frontend** (después; requiere la URL del backend):
   ```bash
   cd frontend
   terraform init
   terraform apply -var="api_url=$(cd ../backend && terraform output -raw api_url)" -var="github_token=TU_TOKEN"
   ```
   O pon `api_url` y `github_token` en `terraform.tfvars`.

## Código y despliegue automático

- **Backend:** para actualizar la Lambda tras cambiar código en `backend/lambda/tasks-api/`, ejecuta `terraform apply` en `backend/`. No hay autodespliegue al hacer push (opcional: añadir GitHub Actions).
- **Frontend:** el **código** React se despliega automáticamente en cada **git push** a la rama que Amplify vigila (build en la nube).
