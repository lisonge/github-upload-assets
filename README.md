# github-upload-assets

upload assets by cloudflare workers

## usage

- method: `POST`
- url: `https://github-upload-assets.lisonge.workers.dev`
- content-type: `multipart/form-data`
- form-data: form fields
  - file: required `File`
  - cookie: optional `string`, your github cookie, default value my cookie (It is unstable and will fail at any time)
  - repository: optional `string`, default value `gkd-kit/inspect`

response: Content-Type: application/json

```json
{
    "id": 12837359,
    "name": "file.zip",
    "size": 2671816,
    "content_type": "application/x-zip-compressed",
    "href": "https://github.com/gkd-kit/inspect/files/12837359/file.zip",
    "original_name": "file.zip"
}
```
