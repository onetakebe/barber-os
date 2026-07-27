# Laravel/MySQL Foundation and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-shaped Laravel API foundation with MySQL, Sanctum session authentication, multi-tenant isolation, role permissions, invitations, demo seed data, and automated verification without replacing the existing Next.js flows yet.

**Architecture:** The Laravel 13 application lives in `api/` as a modular monolith. First-party browser authentication uses Sanctum's stateful session cookie, while a request-scoped `TenantContext` derives the active tenant from the authenticated membership. Controllers remain thin; validation uses Form Requests, authorization uses Policies and middleware, and every tenant resource query is explicitly scoped.

**Tech Stack:** Laravel 13, PHP 8.3+, MySQL 8.4/InnoDB, Redis, Laravel Sanctum, PHPUnit, Laravel Pint, Larastan, Next.js 16.2 frontend retained during migration.

---

## Scope boundary

This is the first independently deployable phase. It deliberately implements only platform foundation, authentication, tenancy, permissions, invitations, seed data, health checks, and documentation. Team, customers, services, availability, bookings, deposits, waitlist, dashboard, loyalty, inventory, and finance receive separate implementation plans after this phase passes.

## File map

- `api/`: generated Laravel application.
- `api/app/Domain/Identity/`: authentication actions and API resources.
- `api/app/Domain/Tenancy/`: tenant context, role enum, permissions, and invitation actions.
- `api/app/Http/Controllers/Api/V1/`: versioned HTTP adapters.
- `api/app/Http/Middleware/`: stateful tenant and request-correlation middleware.
- `api/app/Http/Requests/`: input validation.
- `api/app/Models/`: Eloquent persistence models.
- `api/database/migrations/`: MySQL schema.
- `api/database/factories/`: test fixtures.
- `api/database/seeders/`: repeatable demo tenants and users.
- `api/tests/Feature/Api/V1/`: HTTP and security behavior.
- `api/tests/Unit/Domain/Tenancy/`: permission matrix behavior.
- `docker-compose.yml`: MySQL, Redis and Mailpit while retaining PostgreSQL during migration.
- `.env.example`: frontend-to-API configuration.
- `README.md`: local startup and verification.

### Task 1: Install the local toolchain and scaffold Laravel

**Files:**
- Create: `api/` through the official Laravel scaffold
- Verify: `api/composer.json`
- Verify: `api/artisan`

- [ ] **Step 1: Verify the required commands are currently absent**

Run:

```bash
php --version
composer --version
mysql --version
```

Expected: at least `php`, `composer`, and `mysql` report `command not found` on the current machine.

- [ ] **Step 2: Install the supported local toolchain**

Run:

```bash
brew install php@8.4 composer mysql@8.4 redis
brew link --force --overwrite php@8.4
brew link --force --overwrite mysql@8.4
```

Expected: Homebrew completes without errors.

- [ ] **Step 3: Verify installed versions**

Run:

```bash
php --version
composer --version
mysql --version
redis-server --version
```

Expected: PHP is at least 8.3, Composer 2.x, MySQL 8.4.x, and Redis responds with its version.

- [ ] **Step 4: Generate the Laravel application**

Run:

```bash
composer create-project laravel/laravel:^13.0 api
cd api
php artisan install:api
php artisan make:session-table
composer require --dev larastan/larastan
```

Expected: `api/artisan`, `api/composer.json`, `api/routes/api.php`, and Sanctum's configuration exist.

- [ ] **Step 5: Configure quality scripts**

Modify `api/composer.json` to contain:

```json
{
  "scripts": {
    "analyse": "phpstan analyse --memory-limit=1G",
    "format": "pint",
    "format:check": "pint --test",
    "test": "php artisan test"
  }
}
```

Merge these entries into the generated `scripts` object without deleting Laravel's generated lifecycle scripts.

Create `api/phpstan.neon`:

```neon
includes:
    - vendor/larastan/larastan/extension.neon

parameters:
    paths:
        - app
    level: 7
    treatPhpDocTypesAsCertain: false
```

- [ ] **Step 6: Run the generated baseline**

Run:

```bash
cd api
composer validate --strict
php artisan test
composer format:check
composer analyse
```

Expected: all generated tests and quality checks pass.

- [ ] **Step 7: Commit the scaffold**

```bash
git add api
git commit -m "build: scaffold Laravel API"
```

### Task 2: Add MySQL, Redis and Mailpit development infrastructure

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `api/.env.example`
- Create: `api/.env.testing`

- [ ] **Step 1: Add a failing configuration assertion**

Create `api/tests/Feature/ConfigurationTest.php`:

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;

final class ConfigurationTest extends TestCase
{
    public function test_api_uses_mysql_and_database_sessions(): void
    {
        self::assertSame('mysql', config('database.default'));
        self::assertSame('database', config('session.driver'));
        self::assertSame('redis', config('cache.limiter'));
    }
}
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run:

```bash
cd api
php artisan test tests/Feature/ConfigurationTest.php
```

Expected: FAIL because the generated test environment does not yet use all three required settings.

- [ ] **Step 3: Extend Docker Compose without removing PostgreSQL**

Append these services and volumes to `docker-compose.yml`, preserving the existing PostgreSQL service:

```yaml
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: barber_os_api
      MYSQL_USER: barber
      MYSQL_PASSWORD: barber
      MYSQL_ROOT_PASSWORD: root
    ports:
      - "3306:3306"
    volumes:
      - barber_mysql:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-proot"]
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - barber_redis:/data

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"
      - "8025:8025"
```

Add:

```yaml
  barber_mysql:
  barber_redis:
```

- [ ] **Step 4: Configure Laravel environments**

Set these values in `api/.env.example`:

```dotenv
APP_NAME="Barber OS API"
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=barber_os_api
DB_USERNAME=barber
DB_PASSWORD=barber
SESSION_DRIVER=database
SESSION_DOMAIN=localhost
SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000
CACHE_STORE=redis
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
MAIL_FROM_ADDRESS="noreply@barber-os.local"
```

Create `api/.env.testing`:

```dotenv
APP_ENV=testing
APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
APP_DEBUG=true
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=barber_os_api_test
DB_USERNAME=barber
DB_PASSWORD=barber
SESSION_DRIVER=database
CACHE_STORE=redis
QUEUE_CONNECTION=sync
MAIL_MAILER=array
```

Add to root `.env.example`:

```dotenv
LARAVEL_API_URL="http://localhost:8000"
AUTH_BACKEND="prisma"
```

- [ ] **Step 5: Configure the dedicated rate-limit store**

In `api/config/cache.php`, add:

```php
'limiter' => env('RATE_LIMITER_STORE', 'redis'),
```

Set `RATE_LIMITER_STORE=redis` in `api/.env.example` and `api/.env.testing`.

- [ ] **Step 6: Start services and create the testing database**

If Docker is available:

```bash
docker compose up -d mysql redis mailpit
docker compose exec mysql mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS barber_os_api_test;"
```

If Docker Desktop is not installed, use Homebrew:

```bash
brew services start mysql@8.4
brew services start redis
mysql -uroot -e "CREATE DATABASE IF NOT EXISTS barber_os_api; CREATE DATABASE IF NOT EXISTS barber_os_api_test; CREATE USER IF NOT EXISTS 'barber'@'localhost' IDENTIFIED BY 'barber'; GRANT ALL ON barber_os_api.* TO 'barber'@'localhost'; GRANT ALL ON barber_os_api_test.* TO 'barber'@'localhost'; FLUSH PRIVILEGES;"
```

Expected: both databases exist and Redis answers `PONG` to `redis-cli ping`.

- [ ] **Step 7: Run the test and commit**

Run:

```bash
cd api
php artisan test tests/Feature/ConfigurationTest.php
```

Expected: PASS.

Commit:

```bash
git add docker-compose.yml .env.example api/.env.example api/.env.testing api/config/cache.php api/tests/Feature/ConfigurationTest.php
git commit -m "build: add MySQL and Redis development services"
```

### Task 3: Standardize API errors, correlation IDs and health

**Files:**
- Create: `api/app/Http/Middleware/AssignRequestId.php`
- Create: `api/app/Support/ApiError.php`
- Modify: `api/bootstrap/app.php`
- Modify: `api/routes/api.php`
- Create: `api/tests/Feature/Api/V1/ApiFoundationTest.php`

- [ ] **Step 1: Write failing API foundation tests**

Create `api/tests/Feature/Api/V1/ApiFoundationTest.php`:

```php
<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;

final class ApiFoundationTest extends TestCase
{
    public function test_health_endpoint_exposes_version_and_request_id(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response
            ->assertOk()
            ->assertHeader('X-Request-Id')
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonPath('data.version', 'v1');
    }

    public function test_unknown_api_route_uses_stable_error_contract(): void
    {
        $response = $this->getJson('/api/v1/does-not-exist');

        $response
            ->assertNotFound()
            ->assertJsonStructure([
                'error' => ['code', 'message', 'fields', 'trace_id'],
            ])
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }
}
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd api
php artisan test tests/Feature/Api/V1/ApiFoundationTest.php
```

Expected: FAIL because `/api/v1/health`, the header, and the error contract do not exist.

- [ ] **Step 3: Implement request correlation**

Create `api/app/Http/Middleware/AssignRequestId.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class AssignRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = $request->headers->get('X-Request-Id') ?: (string) Str::ulid();
        $request->attributes->set('request_id', $requestId);

        $response = $next($request);
        $response->headers->set('X-Request-Id', $requestId);

        return $response;
    }
}
```

- [ ] **Step 4: Implement the stable error response**

Create `api/app/Support/ApiError.php`:

```php
<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ApiError
{
    /**
     * @param array<string, array<int, string>> $fields
     */
    public static function response(
        Request $request,
        string $code,
        string $message,
        int $status,
        array $fields = [],
    ): JsonResponse {
        return response()->json([
            'error' => [
                'code' => $code,
                'message' => $message,
                'fields' => $fields,
                'trace_id' => (string) $request->attributes->get('request_id', ''),
            ],
        ], $status);
    }
}
```

Configure `api/bootstrap/app.php` to:

- enable `statefulApi()`;
- append `AssignRequestId` to API middleware;
- render API `NotFoundHttpException` as `ApiError::response($request, 'NOT_FOUND', 'Recurso não encontrado.', 404)`;
- render JSON validation errors with code `VALIDATION_FAILED` and status 422.

- [ ] **Step 5: Add the versioned health route**

Replace the generated sample route in `api/routes/api.php` with:

```php
<?php

use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', fn () => [
        'data' => [
            'status' => 'ok',
            'version' => 'v1',
        ],
    ]);
});
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
cd api
php artisan test tests/Feature/Api/V1/ApiFoundationTest.php
composer format:check
composer analyse
```

Expected: all checks pass.

Commit:

```bash
git add api/app/Http/Middleware/AssignRequestId.php api/app/Support/ApiError.php api/bootstrap/app.php api/routes/api.php api/tests/Feature/Api/V1/ApiFoundationTest.php
git commit -m "feat: establish versioned API contract"
```

### Task 4: Create identity and tenancy schema

**Files:**
- Create: `api/app/Domain/Tenancy/Role.php`
- Create: `api/app/Models/Tenant.php`
- Create: `api/app/Models/Membership.php`
- Modify: `api/app/Models/User.php`
- Create: `api/database/migrations/*_create_tenants_table.php`
- Create: `api/database/migrations/*_create_memberships_table.php`
- Modify: `api/database/factories/UserFactory.php`
- Create: `api/database/factories/TenantFactory.php`
- Create: `api/database/factories/MembershipFactory.php`
- Create: `api/tests/Feature/Database/TenancySchemaTest.php`

- [ ] **Step 1: Write a failing schema test**

Create `api/tests/Feature/Database/TenancySchemaTest.php`:

```php
<?php

namespace Tests\Feature\Database;

use App\Domain\Tenancy\Role;
use App\Models\Membership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class TenancySchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_belong_to_two_tenants_with_different_roles(): void
    {
        $user = User::factory()->create();
        $first = Tenant::factory()->create();
        $second = Tenant::factory()->create();

        Membership::factory()->for($user)->for($first)->create(['role' => Role::Owner]);
        Membership::factory()->for($user)->for($second)->create(['role' => Role::Professional]);

        self::assertCount(2, $user->fresh()->memberships);
        self::assertSame(Role::Owner, $user->memberships->firstWhere('tenant_id', $first->id)->role);
    }

    public function test_duplicate_membership_is_rejected(): void
    {
        $user = User::factory()->create();
        $tenant = Tenant::factory()->create();
        Membership::factory()->for($user)->for($tenant)->create();

        $this->expectException(\Illuminate\Database\QueryException::class);
        Membership::factory()->for($user)->for($tenant)->create();
    }
}
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd api
php artisan test tests/Feature/Database/TenancySchemaTest.php
```

Expected: FAIL because the tenant classes and tables do not exist.

- [ ] **Step 3: Define the role enum**

Create `api/app/Domain/Tenancy/Role.php`:

```php
<?php

namespace App\Domain\Tenancy;

enum Role: string
{
    case Owner = 'OWNER';
    case Admin = 'ADMIN';
    case Manager = 'MANAGER';
    case Receptionist = 'RECEPTIONIST';
    case Professional = 'PROFESSIONAL';
    case Customer = 'CUSTOMER';
}
```

- [ ] **Step 4: Create MySQL migrations**

The tenant migration must create:

```php
Schema::create('tenants', function (Blueprint $table): void {
    $table->ulid('id')->primary();
    $table->string('name');
    $table->string('slug')->unique();
    $table->string('timezone')->default('Europe/Brussels');
    $table->char('currency', 3)->default('EUR');
    $table->unsignedSmallInteger('cancellation_notice_hours')->default(24);
    $table->unsignedInteger('default_deposit_cents')->default(500);
    $table->timestamps(3);
    $table->softDeletesTz('deleted_at', 3);
});
```

The membership migration must create:

```php
Schema::create('memberships', function (Blueprint $table): void {
    $table->ulid('id')->primary();
    $table->foreignUlid('tenant_id')->constrained()->cascadeOnDelete();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('role', 32);
    $table->json('permission_overrides')->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps(3);
    $table->unique(['tenant_id', 'user_id']);
    $table->index(['tenant_id', 'role', 'is_active']);
});
```

- [ ] **Step 5: Implement models and factories**

`Tenant` uses `HasUlids`, `HasFactory`, `SoftDeletes`, guarded IDs, and relationships to memberships and users through memberships.

`Membership` uses `HasUlids`, `HasFactory`, casts `role` to `Role`, casts `permission_overrides` to array, and defines `tenant()` and `user()`.

`User` defines:

```php
public function memberships(): HasMany
{
    return $this->hasMany(Membership::class);
}

public function tenants(): BelongsToMany
{
    return $this->belongsToMany(Tenant::class, 'memberships')
        ->withPivot(['role', 'permission_overrides', 'is_active'])
        ->withTimestamps();
}
```

Factories must generate valid ULIDs through the models and default a membership to `Role::Professional`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
cd api
php artisan test tests/Feature/Database/TenancySchemaTest.php
composer format:check
composer analyse
```

Expected: PASS.

Commit:

```bash
git add api/app/Domain/Tenancy/Role.php api/app/Models api/database/migrations api/database/factories api/tests/Feature/Database/TenancySchemaTest.php
git commit -m "feat: add identity and tenancy schema"
```

### Task 5: Implement Sanctum session authentication

**Files:**
- Create: `api/app/Domain/Identity/AuthenticatedUserResource.php`
- Create: `api/app/Http/Controllers/Api/V1/AuthController.php`
- Create: `api/app/Http/Requests/LoginRequest.php`
- Modify: `api/routes/api.php`
- Create: `api/tests/Feature/Api/V1/AuthenticationTest.php`

- [ ] **Step 1: Write failing authentication tests**

Create `api/tests/Feature/Api/V1/AuthenticationTest.php` with tests that:

```php
public function test_user_can_login_and_read_current_identity(): void
{
    $user = User::factory()->create(['password' => Hash::make('demo123')]);
    $tenant = Tenant::factory()->create();
    Membership::factory()->for($user)->for($tenant)->create(['role' => Role::Owner]);

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'demo123',
    ])->assertOk()->assertJsonPath('data.tenant.id', $tenant->id);

    $this->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('data.role', 'OWNER');
}

public function test_login_rejects_invalid_credentials_without_revealing_account_state(): void
{
    User::factory()->create(['email' => 'owner@example.test']);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'owner@example.test',
        'password' => 'wrong-password',
    ])->assertUnauthorized()->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
}

public function test_login_requires_an_active_membership(): void
{
    $user = User::factory()->create(['password' => Hash::make('demo123')]);

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'demo123',
    ])->assertForbidden()->assertJsonPath('error.code', 'NO_ACTIVE_TENANT');
}

public function test_logout_invalidates_the_session(): void
{
    $user = User::factory()->create();
    $tenant = Tenant::factory()->create();
    Membership::factory()->for($user)->for($tenant)->create();

    $this->actingAs($user)->withSession(['active_tenant_id' => $tenant->id])
        ->postJson('/api/v1/auth/logout')
        ->assertNoContent();

    $this->getJson('/api/v1/me')->assertUnauthorized();
}
```

Use `RefreshDatabase` and the required imports.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd api
php artisan test tests/Feature/Api/V1/AuthenticationTest.php
```

Expected: FAIL because the routes and controller do not exist.

- [ ] **Step 3: Validate login input**

Create `LoginRequest` with:

```php
public function rules(): array
{
    return [
        'email' => ['required', 'email:rfc', 'max:255'],
        'password' => ['required', 'string', 'max:255'],
    ];
}
```

Normalize the email to lowercase in `prepareForValidation()`.

- [ ] **Step 4: Implement the auth controller**

`login()` must:

1. call `Auth::attempt($request->validated(), true)`;
2. return `INVALID_CREDENTIALS` on failure;
3. select the first active membership whose tenant is not deleted;
4. log out and return `NO_ACTIVE_TENANT` if none exists;
5. regenerate the session;
6. store `active_tenant_id`;
7. return user, tenant, role and permissions.

`logout()` must call `Auth::guard('web')->logout()`, invalidate the session, regenerate the CSRF token, and return 204.

`me()` must load the active membership and return the same identity resource.

- [ ] **Step 5: Add throttled routes**

Inside `/api/v1`:

```php
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});
```

Configure a named `login` rate limiter keyed by normalized email and IP with five attempts per minute.

- [ ] **Step 6: Verify and commit**

Run:

```bash
cd api
php artisan test tests/Feature/Api/V1/AuthenticationTest.php
composer format:check
composer analyse
```

Expected: PASS.

Commit:

```bash
git add api/app/Domain/Identity api/app/Http/Controllers/Api/V1/AuthController.php api/app/Http/Requests/LoginRequest.php api/routes/api.php api/bootstrap/app.php api/tests/Feature/Api/V1/AuthenticationTest.php
git commit -m "feat: add stateful Sanctum authentication"
```

### Task 6: Enforce request-scoped tenant isolation

**Files:**
- Create: `api/app/Domain/Tenancy/TenantContext.php`
- Create: `api/app/Http/Middleware/ResolveTenant.php`
- Modify: `api/bootstrap/app.php`
- Modify: `api/routes/api.php`
- Create: `api/tests/Feature/Api/V1/TenantIsolationTest.php`

- [ ] **Step 1: Write failing isolation tests**

Create tests proving:

```php
public function test_authenticated_request_resolves_active_tenant_from_session(): void
{
    [$user, $tenant] = $this->memberFixture(Role::Owner);

    $this->actingAs($user)
        ->withSession(['active_tenant_id' => $tenant->id])
        ->getJson('/api/v1/tenant-context')
        ->assertOk()
        ->assertJsonPath('data.tenant_id', $tenant->id);
}

public function test_user_cannot_select_a_tenant_without_active_membership(): void
{
    $user = User::factory()->create();
    $foreignTenant = Tenant::factory()->create();

    $this->actingAs($user)
        ->withSession(['active_tenant_id' => $foreignTenant->id])
        ->getJson('/api/v1/tenant-context')
        ->assertForbidden()
        ->assertJsonPath('error.code', 'TENANT_ACCESS_DENIED');
}

public function test_tenant_id_from_request_body_is_ignored(): void
{
    [$user, $tenant] = $this->memberFixture(Role::Owner);
    $foreignTenant = Tenant::factory()->create();

    $this->actingAs($user)
        ->withSession(['active_tenant_id' => $tenant->id])
        ->getJson('/api/v1/tenant-context?tenant_id='.$foreignTenant->id)
        ->assertJsonPath('data.tenant_id', $tenant->id);
}
```

- [ ] **Step 2: Verify failure**

Run:

```bash
cd api
php artisan test tests/Feature/Api/V1/TenantIsolationTest.php
```

Expected: FAIL because the middleware and context do not exist.

- [ ] **Step 3: Implement TenantContext**

`TenantContext` stores exactly one `Tenant` and `Membership` for the current request and throws `LogicException` if accessed before resolution:

```php
final class TenantContext
{
    public function __construct(
        private ?Tenant $tenant = null,
        private ?Membership $membership = null,
    ) {}

    public function set(Tenant $tenant, Membership $membership): void
    {
        $this->tenant = $tenant;
        $this->membership = $membership;
    }

    public function tenant(): Tenant
    {
        return $this->tenant ?? throw new LogicException('Tenant context was not resolved.');
    }

    public function membership(): Membership
    {
        return $this->membership ?? throw new LogicException('Tenant context was not resolved.');
    }
}
```

Register it as scoped in the service container.

- [ ] **Step 4: Implement tenant resolution**

`ResolveTenant` must query `memberships` with all of:

```php
Membership::query()
    ->where('tenant_id', $request->session()->get('active_tenant_id'))
    ->where('user_id', $request->user()->getKey())
    ->where('is_active', true)
    ->whereHas('tenant', fn (Builder $query) => $query->whereNull('deleted_at'))
    ->with('tenant')
    ->first();
```

Missing membership returns `TENANT_ACCESS_DENIED` with 403. It must never inspect `tenant_id` from query parameters, route input or request body.

- [ ] **Step 5: Register middleware and probe route**

Alias the middleware as `tenant` and add a temporary authenticated test route:

```php
Route::middleware(['auth:sanctum', 'tenant'])->get('/tenant-context', function (TenantContext $context) {
    return ['data' => ['tenant_id' => $context->tenant()->id]];
});
```

The probe route remains available only in `local` and `testing` environments.

- [ ] **Step 6: Verify and commit**

Run:

```bash
cd api
php artisan test tests/Feature/Api/V1/TenantIsolationTest.php
composer format:check
composer analyse
```

Expected: PASS.

Commit:

```bash
git add api/app/Domain/Tenancy/TenantContext.php api/app/Http/Middleware/ResolveTenant.php api/bootstrap/app.php api/routes/api.php api/tests/Feature/Api/V1/TenantIsolationTest.php
git commit -m "feat: enforce request tenant context"
```

### Task 7: Add role permissions and authorization middleware

**Files:**
- Create: `api/app/Domain/Tenancy/Permission.php`
- Create: `api/app/Domain/Tenancy/RolePermissions.php`
- Create: `api/app/Http/Middleware/RequirePermission.php`
- Modify: `api/bootstrap/app.php`
- Create: `api/tests/Unit/Domain/Tenancy/RolePermissionsTest.php`
- Create: `api/tests/Feature/Api/V1/AuthorizationTest.php`

- [ ] **Step 1: Write failing permission matrix tests**

Test the complete MVP matrix:

```php
#[DataProvider('permissionCases')]
public function test_role_permission_matrix(Role $role, Permission $permission, bool $expected): void
{
    self::assertSame($expected, RolePermissions::allows($role, $permission));
}

public static function permissionCases(): array
{
    return [
        'owner manages members' => [Role::Owner, Permission::MembersManage, true],
        'manager manages catalog' => [Role::Manager, Permission::CatalogManage, true],
        'receptionist manages schedule' => [Role::Receptionist, Permission::ScheduleManage, true],
        'professional reads own schedule' => [Role::Professional, Permission::OwnScheduleRead, true],
        'professional cannot manage finance' => [Role::Professional, Permission::FinanceManage, false],
        'customer cannot access dashboard' => [Role::Customer, Permission::DashboardRead, false],
    ];
}
```

- [ ] **Step 2: Verify unit test failure**

Run:

```bash
cd api
php artisan test tests/Unit/Domain/Tenancy/RolePermissionsTest.php
```

Expected: FAIL because permissions are undefined.

- [ ] **Step 3: Define permissions and mapping**

`Permission` values:

```php
case DashboardRead = 'dashboard.read';
case MembersManage = 'members.manage';
case CatalogManage = 'catalog.manage';
case CustomersManage = 'customers.manage';
case ScheduleManage = 'schedule.manage';
case OwnScheduleRead = 'schedule.own.read';
case BillingManage = 'billing.manage';
case WaitlistManage = 'waitlist.manage';
case LoyaltyManage = 'loyalty.manage';
case InventoryManage = 'inventory.manage';
case FinanceManage = 'finance.manage';
case SettingsManage = 'settings.manage';
```

`Owner` and `Admin` allow all. `Manager` allows all except membership ownership transfer. `Receptionist` allows dashboard, customers, catalog read through catalog manage for the MVP, schedule, billing and waitlist. `Professional` allows own schedule only. `Customer` has no dashboard permissions.

- [ ] **Step 4: Verify the matrix passes**

Run:

```bash
cd api
php artisan test tests/Unit/Domain/Tenancy/RolePermissionsTest.php
```

Expected: PASS.

- [ ] **Step 5: Write the failing HTTP authorization test**

Add a test-only protected route and prove an owner gets 200 while a professional receives:

```json
{
  "error": {
    "code": "FORBIDDEN"
  }
}
```

with status 403.

- [ ] **Step 6: Implement `RequirePermission`**

The middleware receives a permission string, converts it with `Permission::from()`, reads the resolved membership from `TenantContext`, checks `RolePermissions::allows()`, and returns `ApiError::response(..., 'FORBIDDEN', 'Você não possui permissão para esta ação.', 403)` when denied.

Alias it as `permission` and protect routes with:

```php
->middleware('permission:members.manage')
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
cd api
php artisan test tests/Unit/Domain/Tenancy/RolePermissionsTest.php tests/Feature/Api/V1/AuthorizationTest.php
composer format:check
composer analyse
```

Expected: PASS.

Commit:

```bash
git add api/app/Domain/Tenancy api/app/Http/Middleware/RequirePermission.php api/bootstrap/app.php api/routes/api.php api/tests/Unit/Domain/Tenancy/RolePermissionsTest.php api/tests/Feature/Api/V1/AuthorizationTest.php
git commit -m "feat: enforce tenant role permissions"
```

### Task 8: Implement secure member invitations

**Files:**
- Create: `api/app/Models/Invitation.php`
- Create: `api/database/migrations/*_create_invitations_table.php`
- Create: `api/app/Domain/Tenancy/CreateInvitation.php`
- Create: `api/app/Domain/Tenancy/AcceptInvitation.php`
- Create: `api/app/Http/Controllers/Api/V1/InvitationController.php`
- Create: `api/app/Http/Requests/CreateInvitationRequest.php`
- Create: `api/app/Http/Requests/AcceptInvitationRequest.php`
- Modify: `api/routes/api.php`
- Create: `api/tests/Feature/Api/V1/InvitationTest.php`

- [ ] **Step 1: Write failing invitation behavior tests**

Tests must prove:

- an owner can create an invitation and receives the raw token once;
- only a SHA-256 token hash is stored;
- a professional cannot invite;
- an expired invitation returns `INVITATION_EXPIRED`;
- an accepted invitation creates one active membership;
- replaying the same token returns `INVITATION_ALREADY_USED`;
- an authenticated user with a different email receives `INVITATION_EMAIL_MISMATCH`.

The central happy-path assertion:

```php
$response = $this->actingAs($owner)
    ->withSession(['active_tenant_id' => $tenant->id])
    ->postJson('/api/v1/invitations', [
        'email' => 'manager@example.test',
        'role' => 'MANAGER',
    ])
    ->assertCreated();

$rawToken = $response->json('data.token');

self::assertDatabaseHas('invitations', [
    'tenant_id' => $tenant->id,
    'email' => 'manager@example.test',
    'token_hash' => hash('sha256', $rawToken),
]);
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
cd api
php artisan test tests/Feature/Api/V1/InvitationTest.php
```

Expected: FAIL because invitations do not exist.

- [ ] **Step 3: Create the invitation schema**

Create:

```php
Schema::create('invitations', function (Blueprint $table): void {
    $table->ulid('id')->primary();
    $table->foreignUlid('tenant_id')->constrained()->cascadeOnDelete();
    $table->foreignId('invited_by_user_id')->constrained('users')->cascadeOnDelete();
    $table->string('email');
    $table->string('role', 32);
    $table->char('token_hash', 64)->unique();
    $table->timestamp('expires_at', 3);
    $table->timestamp('accepted_at', 3)->nullable();
    $table->foreignId('accepted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps(3);
    $table->index(['tenant_id', 'email', 'accepted_at']);
});
```

- [ ] **Step 4: Implement invitation creation**

`CreateInvitation` must run in a transaction, invalidate previous unused invitations for the same tenant/e-mail, generate `Str::random(64)`, store only `hash('sha256', $token)`, expire after 72 hours, and return both model and raw token.

- [ ] **Step 5: Implement invitation acceptance atomically**

`AcceptInvitation` must use `DB::transaction(..., attempts: 5)`, select the invitation `lockForUpdate()`, validate state/e-mail, use `Membership::firstOrCreate()`, mark accepted, and return the membership. A second call must fail without changing data.

- [ ] **Step 6: Expose authorized routes**

```php
Route::middleware(['auth:sanctum', 'tenant'])->group(function (): void {
    Route::post('/invitations', [InvitationController::class, 'store'])
        ->middleware('permission:members.manage');
    Route::post('/invitations/{token}/accept', [InvitationController::class, 'accept']);
});
```

Creation validation accepts only e-mail and non-owner operational roles. Acceptance takes the token only from the route and the user identity only from authentication.

- [ ] **Step 7: Verify and commit**

Run:

```bash
cd api
php artisan test tests/Feature/Api/V1/InvitationTest.php
composer format:check
composer analyse
```

Expected: PASS.

Commit:

```bash
git add api/app/Models/Invitation.php api/database/migrations api/app/Domain/Tenancy api/app/Http/Controllers/Api/V1/InvitationController.php api/app/Http/Requests api/routes/api.php api/tests/Feature/Api/V1/InvitationTest.php
git commit -m "feat: add secure tenant invitations"
```

### Task 9: Add audit logs and authentication events

**Files:**
- Create: `api/app/Models/AuditLog.php`
- Create: `api/database/migrations/*_create_audit_logs_table.php`
- Create: `api/app/Domain/Auditing/Audit.php`
- Modify: `api/app/Http/Controllers/Api/V1/AuthController.php`
- Modify: `api/app/Domain/Tenancy/CreateInvitation.php`
- Modify: `api/app/Domain/Tenancy/AcceptInvitation.php`
- Create: `api/tests/Feature/AuditLogTest.php`

- [ ] **Step 1: Write failing audit tests**

Prove successful login, logout, invitation creation and acceptance write rows with:

- tenant where known;
- actor user;
- action string;
- subject type and ID;
- request ID;
- sanitized metadata without passwords or raw tokens.

Example:

```php
self::assertDatabaseHas('audit_logs', [
    'tenant_id' => $tenant->id,
    'actor_user_id' => $owner->id,
    'action' => 'invitation.created',
    'subject_type' => Invitation::class,
]);

self::assertDatabaseMissing('audit_logs', [
    'metadata' => json_encode(['token' => $rawToken]),
]);
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
cd api
php artisan test tests/Feature/AuditLogTest.php
```

Expected: FAIL because audit logs do not exist.

- [ ] **Step 3: Create immutable audit persistence**

The table uses ULID, nullable tenant and actor FKs, action, subject type/ID, request ID, IP, user agent, JSON metadata, and `created_at`; it has no `updated_at` or soft delete.

`Audit::record()` whitelists metadata passed by callers and never accepts request input wholesale.

- [ ] **Step 4: Record security events**

Record:

```text
auth.login
auth.logout
invitation.created
invitation.accepted
```

Failed login is logged to the application security log with normalized e-mail hash and IP, but not stored as a tenant audit record because tenant identity is not trusted yet.

- [ ] **Step 5: Verify and commit**

Run:

```bash
cd api
php artisan test tests/Feature/AuditLogTest.php
composer format:check
composer analyse
```

Expected: PASS.

Commit:

```bash
git add api/app/Models/AuditLog.php api/database/migrations api/app/Domain/Auditing api/app/Http/Controllers/Api/V1/AuthController.php api/app/Domain/Tenancy api/tests/Feature/AuditLogTest.php
git commit -m "feat: audit security-sensitive actions"
```

### Task 10: Add repeatable two-tenant demo data

**Files:**
- Create: `api/database/seeders/DemoTenantSeeder.php`
- Modify: `api/database/seeders/DatabaseSeeder.php`
- Create: `api/tests/Feature/Database/DemoTenantSeederTest.php`

- [ ] **Step 1: Write a failing repeatability test**

Create a test that calls the seeder twice and asserts:

```php
self::assertSame(2, Tenant::query()->count());
self::assertSame(5, User::query()->count());
self::assertSame(5, Membership::query()->count());
self::assertDatabaseHas('users', ['email' => 'owner@asbarber.be']);
self::assertDatabaseHas('users', ['email' => 'owner@northcut.be']);
self::assertTrue(Hash::check('demo123', User::where('email', 'owner@asbarber.be')->value('password')));
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
cd api
php artisan test tests/Feature/Database/DemoTenantSeederTest.php
```

Expected: FAIL because the demo seeder does not exist.

- [ ] **Step 3: Implement an idempotent seeder**

Use `updateOrCreate()` for:

- tenant `as-barber-club`;
- tenant `north-cut-demo`;
- `owner@asbarber.be` as OWNER;
- `gerente@asbarber.be` as MANAGER;
- `recepcao@asbarber.be` as RECEPTIONIST;
- `lucas@asbarber.be` as PROFESSIONAL;
- `owner@northcut.be` as OWNER.

Use `Hash::make('demo123')`. In non-local/non-testing environments, throw a `RuntimeException` before modifying data.

- [ ] **Step 4: Verify and commit**

Run:

```bash
cd api
php artisan test tests/Feature/Database/DemoTenantSeederTest.php
composer format:check
composer analyse
```

Expected: PASS.

Commit:

```bash
git add api/database/seeders api/tests/Feature/Database/DemoTenantSeederTest.php
git commit -m "feat: seed isolated demo tenants"
```

### Task 11: Document and verify the first phase

**Files:**
- Modify: `README.md`
- Create: `api/README.md`
- Create: `docs/laravel-api.md`
- Modify: `package.json`

- [ ] **Step 1: Add root orchestration scripts**

Merge into root `package.json`:

```json
{
  "scripts": {
    "api:test": "cd api && php artisan test",
    "api:analyse": "cd api && composer analyse",
    "api:format:check": "cd api && composer format:check",
    "api:migrate": "cd api && php artisan migrate",
    "api:seed": "cd api && php artisan db:seed"
  }
}
```

- [ ] **Step 2: Document exact local startup**

`api/README.md` must document:

```bash
cd /Users/gverdonck/Documents/barber
brew services start mysql@8.4
brew services start redis
cp api/.env.example api/.env
cd api
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

And in a second terminal:

```bash
cd /Users/gverdonck/Documents/barber
npm install
npm run dev
```

- [ ] **Step 3: Document API behavior**

`docs/laravel-api.md` must include:

- local URLs;
- CSRF and login sequence;
- demo users;
- tenant derivation rule;
- permission matrix;
- stable error envelope;
- implemented endpoints;
- external integrations still simulated;
- migration flags still set to Prisma.

- [ ] **Step 4: Run all phase checks**

Run:

```bash
cd /Users/gverdonck/Documents/barber/api
composer validate --strict
php artisan migrate:fresh --seed --env=testing
composer format:check
composer analyse
php artisan test

cd /Users/gverdonck/Documents/barber
npm install
npm run db:generate
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits with code 0.

- [ ] **Step 5: Smoke-test the running API**

Run Laravel and verify:

```bash
curl -i http://localhost:8000/api/v1/health
curl -c /tmp/barber-cookies.txt http://localhost:8000/sanctum/csrf-cookie
```

Expected: health returns 200 with `X-Request-Id`; CSRF endpoint returns 204 and sets cookies.

- [ ] **Step 6: Commit documentation and orchestration**

```bash
git add README.md api/README.md docs/laravel-api.md package.json package-lock.json
git commit -m "docs: document Laravel API foundation"
```

## Phase completion criteria

The phase is complete only when:

- all Laravel migrations run on MySQL;
- the two-tenant seed is repeatable;
- login, logout and `/me` work through Sanctum session auth;
- tenant identity cannot be supplied or overridden by the client;
- roles are enforced server-side;
- invitations are hashed, expiring and single-use;
- security-sensitive actions are audited without secrets;
- API errors contain a stable code and trace ID;
- Laravel tests, Pint, Larastan, Next.js lint, typecheck, tests and build all pass;
- Prisma remains the active backend for the existing frontend until the next module reaches parity.
