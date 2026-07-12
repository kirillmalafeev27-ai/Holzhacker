# Публикация Waldwacht

## Что обязательно загрузить в GitHub

- `package.json`
- `package-lock.json`
- `server.js`
- `render.yaml`
- `.gitignore`
- всю папку `public/`, кроме файлов `*.blend` и `*.blend1`

Этого набора достаточно для запуска игры на Render. Все используемые браузером
GLB находятся внутри `public/assets/`, включая `log_large.glb`; папка
`GLTF format/` на сервере не нужна.

## Что можно добавить как исходники

Для дальнейшей пересборки моделей можно отдельно сохранить Python-скрипты из
корня проекта: `build_first_person_world.py`,
`build_first_person_gameplay_assets.py`, `export_chop_models.py` и
`inspect_first_person_assets.py`. Blender-файлы лучше хранить в Git LFS или в
отдельном архиве, а не в обычном Git-репозитории.

## Развёртывание на Render

1. Создайте GitHub-репозиторий и загрузите перечисленные файлы в его корень.
2. В Render выберите **New → Blueprint** и подключите репозиторий.
3. Render прочитает `render.yaml`, выполнит `npm ci` и запустит `npm start`.
4. Проверка здоровья использует `/`; сервер слушает назначенный Render порт на
   `0.0.0.0`.

Для локальной проверки используются команды `npm ci`, `npm run check`,
`npm test`, `npm start`, после чего игра доступна по адресу
`http://127.0.0.1:4173/`.

