# Gmail inbox · Vanilla JS + MongoDB Atlas

Lista, búsqueda, estrella, leído y borrar. Node `http` nativo.
Colección Atlas: `gmail.mail`.

## Local

```bash
npm install
npm start
```

Sin `MONGODB_URI` usa `/tmp`.

## Cloud Run

```bash
export GCP_PROJECT_ID=project-778283d9-dc7e-4c2c-947
export MONGODB_URI="mongodb+srv://USER:PASS@CLUSTER.mongodb.net/gmail?retryWrites=true&w=majority&authSource=admin"

gcloud run deploy gmail-inbox-vanilla \
  --project $GCP_PROJECT_ID \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --update-env-vars="MONGODB_URI=${MONGODB_URI},MONGODB_DB=gmail,MONGODB_COLLECTION=mail"
```

`/health` tiene que decir `"store":"mongodb"`.

## API

- `GET /api/mail?q=`
- `GET /api/mail/:id` (marca leído)
- `POST /api/mail/:id/star`
- `DELETE /api/mail/:id`
- `GET /health`
