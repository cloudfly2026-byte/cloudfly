# StoreFront - Análisis Completo: Traefik + StoreFront + WebTemplates + DB

## 1. FLUJO GENERAL

```
Usuario → Traefik (:443/:80) → StoreFront (Go/Fiber :8080) → MySQL + Redis
                                    ↓
                              webTemplates/default/index.html
                                    ↓
                              HTML renderizado con datos de BD
```

## 2. TRAEFIK - Configuración

### traefik.yml (estático)
- **Entrypoints:** :80 (HTTP) → redirige a :443 (HTTPS)
- **Certificados:** Let's Encrypt via TLS challenge
- **Provider:** Docker (red `cloudfly_app-net`)
- **Dashboard:** habilitado

### docker-compose labels (storefront)
```yaml
traefik.http.routers.storefront.rule=Host(`cloudflyshop.cloudfly.com.co`) || HostRegexp(`^[a-z0-9-]+\.cloudfly\.com\.co$`)
```
Esto significa que el storefront maneja:
- `cloudflyshop.cloudfly.com.co` (dominio principal)
- Cualquier subdominio `*.cloudfly.com.co` (multi-tenant)

### ⚠️ PROBLEMA #1: dynamic_conf.yml NO incluye el storefront
El archivo `dynamic_conf.yml` tiene rutas para `api.cloudfly.com.co` y `dashboard.cloudfly.com.co`, pero NO para `cloudflyshop.cloudfly.com.co` ni para subdominios del storefront. Esto significa que el storefront SOLO funciona vía labels de Docker (que está bien), pero si alguien quiere acceder por IP o dominio no registrado en labels, no funcionará.

## 3. STOREFRONT (Go/Fiber) - Flujo de Datos

### 3.1 Resolución de Dominio (home.go)
1. Extrae el hostname de la request
2. Si es localhost/127.0.0.1/192.168.x.x/10.x.x.x → usa `cloudflyshop.cloudfly.com.co` como fallback
3. Busca en `company_domains` table → obtiene `tenant_id`, `company_id`, `estado`, `fecha_caduca`
4. Si no está registrado y no es local → redirige a `https://www.cloudfly.com.co`
5. Verifica que la suscripción esté activa en `subscriptions` table

### 3.2 Carga de Datos
1. **Company:** SELECT de `companies` table → `name`, `logo_url`, `company_description`
2. **Categories:** SELECT de `categorias` table → `name`, `slug` (generado), `icon` (auto-detectado)
3. **Products:** SELECT de `productos` table → `product_name`, `description`, `price`, `brand`, `inventory_status`
   - Para cada producto busca: categoría en `product_categories` + `categorias`, imagen en `product_images` + `media`

### 3.3 Caché Redis
- Clave: `storefront:html:{tenantID}:{companyID}`
- TTL: 10 minutos
- Si hay cache hit → retorna HTML directamente sin consultar BD

### 3.4 Renderizado
- Busca el template `webTemplates/default/index.html` en múltiples rutas
- Parsea con `html/template` de Go
- Inyecta `StorefrontData{Company, Theme, Categories, Products}`

## 4. BASE DE DATOS - Tablas Relevantes para StoreFront

### 4.1 `company_domains`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | PK |
| tenant_id | bigint | FK → clientes.id |
| company_id | bigint | FK → companies.id |
| domain_name | varchar(255) | Dominio único (ej: cloudflyshop.cloudfly.com.co) |
| estado | varchar(50) | 'activo' / otros |
| fecha_caduca | timestamp | Fecha de caducidad del dominio |

### 4.2 `companies`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | PK |
| tenant_id | bigint | FK → clientes.id |
| name | varchar(255) | Nombre de la empresa |
| logo_url | varchar(512) | URL del logo |
| company_description | text | Descripción |
| phone | varchar(50) | Teléfono |
| email | varchar(255) | Email |
| address | varchar(255) | Dirección |
| status | tinyint(1) | Activo/inactivo |

### 4.3 `categorias`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | PK |
| name | varchar(255) | Nombre de la categoría |
| description | text | Descripción |
| status | tinyint(1) | Activo/inactivo |
| tenant_id | bigint | FK → clientes.id |
| company_id | bigint | FK → companies.id |

### 4.4 `productos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | PK |
| product_name | varchar(255) | Nombre del producto |
| description | text | Descripción |
| price | decimal(15,2) | Precio |
| sale_price | decimal(15,2) | Precio de oferta |
| brand | varchar(100) | Marca |
| inventory_status | varchar(50) | 'IN_STOCK' / otros |
| inventory_qty | int | Cantidad en inventario |
| status | varchar(20) | 'ACTIVE' / 'PUBLISHED' / otros |
| sku | varchar(100) | SKU |
| weight | decimal(10,3) | Peso |
| dimensions | varchar(100) | Dimensiones |

### 4.5 `product_categories` (relación N:M)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| product_id | bigint | FK → productos.id |
| category_id | bigint | FK → categorias.id |

### 4.6 `product_images` (relación N:M)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| product_id | bigint | FK → productos.id |
| media_id | bigint | FK → media.id |

### 4.7 `media`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | PK |
| url | varchar(500) | URL de la imagen |
| filename | varchar(255) | Nombre del archivo |
| original_name | varchar(255) | Nombre original |

### 4.8 `subscriptions`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | PK |
| customer_id | bigint | FK → clientes.id |
| status | varchar(50) | 'ACTIVE' / otros |
| end_date | datetime | Fecha de fin |

## 5. DATOS QUE LA PLANTILLA ESPERA vs BD

### 5.1 Company (Go struct ↔ Template)
| Go struct field | Template variable | BD column | ✅/❌ |
|----------------|-------------------|-----------|------|
| Company.Name | {{.Company.Name}} | companies.name | ✅ |
| Company.Logo | {{.Company.Logo}} | companies.logo_url | ✅ |
| Company.Description | (no usado en template) | companies.company_description | ⚠️ No se usa |

### 5.2 Theme
| Go struct field | Template variable | Valor | ✅/❌ |
|----------------|-------------------|-------|------|
| Theme.PrimaryColor | {{.Theme.PrimaryColor}} | Hardcoded #6366f1 | ⚠️ No viene de BD |
| Theme.SecondaryColor | {{.Theme.SecondaryColor}} | Hardcoded #10b981 | ⚠️ No viene de BD |

### 5.3 Categories
| Go struct field | Template variable | BD column | ✅/❌ |
|----------------|-------------------|-----------|------|
| Category.Name | {{.Name}} | categorias.name | ✅ |
| Category.Slug | {{.Slug}} | Generado en Go (slugify) | ✅ |
| Category.Icon | {{.Icon}} | Auto-detectado en Go | ✅ |

### 5.4 Products
| Go struct field | Template variable | BD column | ✅/❌ |
|----------------|-------------------|-----------|------|
| Product.Name | {{$element.Name}} | productos.product_name | ✅ |
| Product.Description | {{$element.Description}} | productos.description | ✅ |
| Product.Price | {{$element.Price}} | productos.price | ✅ |
| Product.Category | {{$element.Category}} | categorias.name (via JOIN) | ✅ |
| Product.Brand | {{$element.Brand}} | productos.brand | ✅ |
| Product.Image | {{$element.Image}} | media.url (via JOIN) | ✅ |
| Product.Rating | {{$element.Rating}} | Hardcoded 4.8 | ⚠️ No viene de BD |
| Product.Available | {{$element.Available}} | productos.inventory_status | ✅ |

## 6. PROBLEMAS ENCONTRADOS

### 🔴 PROBLEMA #1: Company.Description no se usa en el template
**Ubicación:** home.go línea 164-166
**Problema:** Se carga `company.Description` de `companies.company_description` pero el template NO lo usa.
**Impacto:** La descripción de la empresa no se muestra en ningún lugar.

### 🔴 PROBLEMA #2: Theme colors hardcoded
**Ubicación:** home.go líneas 147-150
**Problema:** Los colores del tema son hardcoded (`#6366f1`, `#10b981`). No hay tabla de temas en BD.
**Impacto:** Todas las tiendas tienen los mismos colores.

### 🔴 PROBLEMA #3: Rating hardcoded a 4.8
**Ubicación:** home.go línea 242
**Problema:** El rating del producto es siempre 4.8, no viene de BD.
**Impacto:** Todos los productos muestran la misma calificación.

### 🔴 PROBLEMA #4: sale_price no se usa
**Ubicación:** BD tiene `productos.sale_price` pero el Go struct no lo incluye.
**Impacto:** No se pueden mostrar precios de oferta/descuento.

### 🔴 PROBLEMA #5: WhatsApp número hardcoded
**Ubicación:** index.html línea 1505
**Problema:** `wa.me/573000000000` es un número placeholder.
**Impacto:** Los botones de WhatsApp no funcionan con el número real de la empresa.

### 🔴 PROBLEMA #6: Company phone/email no se usan
**Ubicación:** BD tiene `companies.phone`, `companies.email`, `companies.address`
**Problema:** El Go struct de Company solo tiene ID, Name, Logo, Description.
**Impacto:** No se muestran datos de contacto reales en el footer/header.

### 🟡 PROBLEMA #7: Sin fallback para datos vacíos en el template
**Ubicación:** index.html
**Problema:** Si no hay productos, categorías o datos de empresa, secciones vacías se muestran sin alternativa.
**Impacto:** La tienda se ve vacía/descuidada sin datos.

### 🟡 PROBLEMA #8: dynamic_conf.yml no tiene rutas para storefront
**Ubicación:** traefik/dynamic_conf.yml
**Problema:** Solo tiene rutas para API y dashboard, no para storefront.
**Impacto:** Depende 100% de Docker labels (funcional pero inconsistente).

## 7. CORRECCIONES RECOMENDADAS

### 7.1 Agregar campos faltantes al Go struct de Company
```go
type Company struct {
    ID          int64  `json:"id"`
    Name        string `json:"name"`
    Logo        string `json:"logo"`
    Description string `json:"description"`
    Phone       string `json:"phone"`     // NUEVO
    Email       string `json:"email"`     // NUEVO
    Address     string `json:"address"`   // NUEVO
}
```

### 7.2 Agregar campos faltantes al Go struct de Product
```go
type Product struct {
    Name        string  `json:"name"`
    Description string  `json:"description"`
    Price       float64 `json:"price"`
    SalePrice   float64 `json:"sale_price"`  // NUEVO
    Category    string  `json:"category"`
    Brand       string  `json:"brand"`
    Image       string  `json:"image"`
    Rating      float64 `json:"rating"`
    Available   bool    `json:"available"`
    SKU         string  `json:"sku"`         // NUEVO
}
```

### 7.3 Cargar datos de company desde BD
Agregar la carga de `phone`, `email`, `address` en la query de companies.

### 7.4 Usar datos de contacto reales en el template
- Reemplazar WhatsApp hardcoded con `{{.Company.Phone}}`
- Mostrar `{{.Company.Email}}` en el footer
- Mostrar `{{.Company.Description}}` en la sección hero

### 7.5 Agregar fallback values en el template
- Si no hay nombre de empresa → "Tienda Online"
- Si no hay logo → placeholder con inicial del nombre
- Si no hay productos → mensaje de "Próximamente"
- Si no hay categorías → ocultar sección

