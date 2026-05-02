# api-masothue

API Node.js + TypeScript + Express phục vụ n8n để tra cứu địa chỉ doanh nghiệp theo Mã số thuế Việt Nam. Ưu tiên nguồn `masothue.com`, fallback sang `thuvienphapluat.vn`.

## Endpoints

### `GET /health`

```json
{ "success": true, "status": "ok" }
```

### `POST /api/tax-lookup`

Request:

```json
{ "taxCode": "0303449450" }
```

`taxCode` chấp nhận:
- 10 chữ số: `0303449450`
- 10 chữ số + `-` + 3 chữ số: `0303449450-001`

Response (tìm thấy):

```json
{
  "success": true,
  "taxCode": "0303449450",
  "companyName": "CÔNG TY TNHH PIL VIỆT NAM",
  "taxAddress": "...",
  "address": "...",
  "source": "masothue.com"
}
```

Response (không tìm thấy — vẫn HTTP 200):

```json
{
  "success": true,
  "taxCode": "0303449450",
  "companyName": null,
  "taxAddress": null,
  "address": null,
  "source": null
}
```

Response (đầu vào sai — HTTP 400):

```json
{
  "success": false,
  "error": "INVALID_TAX_CODE",
  "message": "taxCode must be 10 digits or 10 digits followed by -XXX"
}
```

## Chạy local (Node.js)

```bash
npm install
npm run dev          # dev mode (ts-node-dev)
npm run build        # biên dịch sang dist/
npm start            # chạy dist/server.js
```

## Chạy bằng Docker (1 lệnh)

```bash
docker compose up -d --build
```

Service expose tại cổng `3001` của host (`3001 -> 3000` bên trong container).

## Test bằng curl

Health check:

```bash
curl http://localhost:3001/health
```

Tra cứu mã số thuế:

```bash
curl -X POST http://localhost:3001/api/tax-lookup \
  -H "Content-Type: application/json" \
  -d '{"taxCode":"0303449450"}'
```

Mã số thuế chi nhánh:

```bash
curl -X POST http://localhost:3001/api/tax-lookup \
  -H "Content-Type: application/json" \
  -d '{"taxCode":"0303449450-001"}'
```

## Cấu hình n8n — HTTP Request node

| Trường | Giá trị |
|---|---|
| Method | `POST` |
| URL | `http://SERVER_IP:3001/api/tax-lookup` |
| Body Content Type | `JSON` |
| JSON Body | `{ "taxCode": "0303449450" }` |

Thay `SERVER_IP` bằng IP/host của server đang chạy container.

## Biến môi trường

File `.env`:

```env
PORT=3000
HTTP_TIMEOUT_MS=10000
NODE_ENV=production
```

## Cấu trúc thư mục

```
src/
  app.ts
  server.ts
  routes/taxLookup.route.ts
  controllers/taxLookup.controller.ts
  services/
    taxLookup.service.ts
    sources/
      masothue.source.ts
      thuvienphapluat.source.ts
  utils/
    httpClient.ts
    normalizeText.ts
    validateTaxCode.ts
  types/taxLookup.types.ts
```

## Ghi chú

- Khi `masothue.com` không có kết quả hoặc lỗi (timeout/anti-bot/HTML thay đổi), API tự fallback sang `thuvienphapluat.vn`.
- Nếu cả hai đều không có dữ liệu, vẫn trả về HTTP 200 với các field bằng `null` để n8n flow tiếp tục bình thường.
- Không trộn `Địa chỉ Thuế` vào `Địa chỉ`. Nếu site không có nhãn tương ứng → field tương ứng là `null`.
