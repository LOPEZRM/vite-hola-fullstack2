# Frontend – Lista de tareas (React + Vite)

Proyecto independiente: app React que consume la API del **backend**. Despliegue en Amplify (Terraform en esta carpeta).

## Estructura

- `main.tf` – Terraform para Amplify (variable `api_url` = URL del backend)
- `src/` – Código React (Vite)
- `package.json`, `vite.config.js`, etc.

## Desarrollo local

1. El backend debe estar desplegado y tener `api_url` en su state.
2. Crear `.env` con la URL de la API:

   ```
   VITE_API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com
   ```
   (Obtener con `cd ../backend && terraform output -raw api_url`)

3. Instalar y ejecutar:

   ```bash
   npm install
   npm run dev
   ```

## Despliegue (Amplify)

1. Desplegar primero el **backend** y anotar la URL: `cd ../backend && terraform output -raw api_url`.
2. En esta carpeta:

   ```bash
   terraform init
   terraform apply -var="api_url=URL_DEL_BACKEND" -var="github_token=TU_TOKEN"
   ```

   O crear `terraform.tfvars` con:
   - `api_url` – URL base de la API (salida del backend)
   - `github_token` – token de GitHub para Amplify
   Opcional: `repository`, `branch_name`, `app_root`.

3. El **código** del frontend se despliega automáticamente en cada **git push** a la rama configurada (Amplify hace build y deploy). El repo que uses en `repository` debe contener este proyecto (o un repo que tenga la misma estructura: package.json, src/, vite, etc.).

## Repo para Amplify

Amplify clona el repo indicado en `repository` y ejecuta `npm ci` y `npm run build`. Puedes:

- **Repo solo con frontend:** deja `app_root` vacío (`app_root = ""` en tfvars) y apunta `repository` al repo del frontend.
- **Monorepo** (backend + frontend en el mismo repo): pon `app_root = "frontend"` (por defecto). Amplify hará el build desde la carpeta `frontend/`. Para que un push que solo toque `backend/` no dispare build, en la consola de Amplify → tu app → rama → "Build settings" / "Monitor path" configura que solo se construya cuando cambien archivos en `frontend/`.
