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

## Cung cấp `companyName` (sinh detailUrl tự động — KHÔNG cần API key)

n8n thường đã có sẵn `companyName`. Truyền cùng `taxCode`, API sẽ tự ghép URL chi tiết theo công thức `https://masothue.com/{taxCode}-{slug(companyName)}` và parse trực tiếp:

```bash
wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='{"taxCode":"1101550146","companyName":"CÔNG TY CỔ PHẦN ANOVA FEED"}' \
  http://127.0.0.1:3001/api/tax-lookup
```

URL sinh ra: `https://masothue.com/1101550146-cong-ty-co-phan-anova-feed`. Slug được tạo bằng `slugifyVietnamese()` (lowercase, bỏ dấu, `đ→d`, `&→and`, các ký tự khác → `-`, gộp `-` lặp).

Nếu URL sinh ra trả 404 hoặc không chứa đúng `taxCode` → tự động chuyển sang flow lookup bình thường (`masothue-direct` → `masothue-search` → `masothue-known` → `tvpl-*`).

## Cung cấp `detailUrl` (bỏ qua mọi search discovery)

n8n vẫn chỉ cần gửi `taxCode`, nhưng nếu biết trước URL chi tiết, có thể truyền kèm để bypass mọi bước search:

```bash
wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='{"taxCode":"1101550146","detailUrl":"https://masothue.com/1101550146-cong-ty-co-phan-anova-feed"}' \
  http://127.0.0.1:3001/api/tax-lookup
```

Yêu cầu:
- `detailUrl` phải có host `masothue.com` hoặc `thuvienphapluat.vn`. Host khác → HTTP 400 `INVALID_DETAIL_URL`.
- HTML trả về phải chứa đúng `taxCode` mới được parse. Nếu lệch → trả về tất cả `null`.

## External search fallback (Brave Search API)

Khi cả `masothue.com` lẫn `thuvienphapluat.vn` đều không tìm thấy (search redirect sai MST, anti-bot, layout đổi…), API có thể tự discover URL chi tiết qua Brave Search.

Bật ở `.env`:

```env
EXTERNAL_SEARCH_ENABLED=true
EXTERNAL_SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=brv-...
EXTERNAL_SEARCH_TIMEOUT_MS=10000
```

Quy trình: query `site:masothue.com {taxCode}` rồi `"{taxCode}" "masothue"`. Lọc URL có host `masothue.com`, path bắt đầu bằng `/{taxCode}-` và **không** chứa `/Search/`. Fetch URL, verify HTML chứa đúng `taxCode`, rồi parse như masothue source.

## Bật debug attempts trong response

Thêm `"includeDebug": true` vào body để nhận thêm trường `debug.attempts`:

```bash
curl -X POST http://localhost:3001/api/tax-lookup \
  -H "Content-Type: application/json" \
  -d '{"taxCode":"1101550146","includeDebug":true}'
```

Ví dụ:

```json
{
  "success": true,
  "taxCode": "1101550146",
  ...,
  "debug": {
    "attempts": [
      { "strategy": "masothue", "matchedTaxCode": true }
    ]
  }
}
```

## Manual test cho tax code chi nhánh / known-URL fallback

Mã số thuế chi nhánh:

```bash
curl -X POST http://localhost:3001/api/tax-lookup \
  -H "Content-Type: application/json" \
  -d '{"taxCode":"0100104595-017"}'
```

Mã số thuế cần known-URL fallback (search redirect bị nhảy sang MST khác):

```bash
wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='{"taxCode":"0315396676"}' \
  http://127.0.0.1:3001/api/tax-lookup
```

```bash
wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='{"taxCode":"1101550146"}' \
  http://127.0.0.1:3001/api/tax-lookup
```

Kết quả phải có `companyName`, `taxAddress`, `address` lấy từ `masothue.com` — không được trả về tất cả `null`.

Kết quả phải có `companyName` và `address` khác `null`:

```json
{
  "success": true,
  "taxCode": "0100104595-017",
  "companyName": "CÔNG TY VẬN TẢI BIỂN CONTAINER VIMC - CHI NHÁNH TỔNG CÔNG TY HÀNG HẢI VIỆT NAM - CTCP",
  "taxAddress": "Tòa nhà Ocean Park, số 1 Đào Duy Anh, Phường Kim Liên, TP Hà Nội, Việt Nam",
  "address": "Tòa nhà Ocean Park, số 1 Đào Duy Anh, Phường Phương Mai, Quận Đống Đa, Thành phố Hà Nội, Việt Nam",
  "source": "masothue.com"
}
```

Nếu masothue.com đổi layout làm bảng `table-taxinfo` không còn, parser sẽ tự động fallback:
- `companyName` ← `<title>` ("`{taxCode} - {companyName} - MaSoThue`")
- `address` ← `<meta name="description">` (đoạn sau `mã số thuế {taxCode} - `)

Khi đó tối thiểu sẽ trả về:

```json
{
  "success": true,
  "taxCode": "0100104595-017",
  "companyName": "CÔNG TY VẬN TẢI BIỂN CONTAINER VIMC - CHI NHÁNH TỔNG CÔNG TY HÀNG HẢI VIỆT NAM - CTCP",
  "taxAddress": null,
  "address": "Tòa nhà Ocean Park, số 1 Đào Duy Anh, Phường Phương Mai, Quận Đống Đa, Thành phố Hà Nội, Việt Nam",
  "source": "masothue.com"
}
```

Bật log debug để xem URL được gọi, redirect cuối cùng, status, title/meta description, fallback và field đã parse:

```bash
DEBUG_LOOKUP=true npm start
```

## Biến môi trường

File `.env`:

```env
PORT=3000
HTTP_TIMEOUT_MS=10000
NODE_ENV=production
DEBUG_LOOKUP=false
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
