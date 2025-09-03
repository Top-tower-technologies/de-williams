# Hotel Menu Management System (JSON + PHP)

A lightweight, file-based (JSON) hotel menu with:
- **User View (index.html)**: browse categories and items, see availability
- **Admin Panel (admin.html)**: create/edit/delete categories and products; set availability and prices
- **Backend (api.php)**: CRUD endpoints persisting to `data.json` with file locking

## Quick Start
1. Copy this folder to a PHP-enabled server (XAMPP, Laragon, WAMP, MAMP, or a Linux/NGINX+PHP setup).
2. Ensure PHP has write permission to `data.json`.
3. Visit `index.html` for the guest menu and `admin.html` for the admin panel.

## API Endpoints (api.php)
- `GET  api.php?action=getMenu`
- `POST api.php?action=addCategory    name`
- `POST api.php?action=updateCategory id, name`
- `POST api.php?action=deleteCategory id`
- `POST api.php?action=addProduct     category_id, name, price, available`
- `POST api.php?action=updateProduct  id, category_id, name, price, available`
- `POST api.php?action=deleteProduct  id`

> Note: This is a simple demo with no authentication. Add proper auth before production use.
