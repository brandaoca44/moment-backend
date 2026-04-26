# 🚀 Moment (Backend)

API da rede social **Moment**, construída com foco em **segurança, performance e escalabilidade**.

## 🧠 Sobre o projeto

O Moment é uma rede social minimalista inspirada no conceito de compartilhar momentos do dia a dia, com foco em leveza e evitando conteúdos tóxicos.

Este backend é responsável por toda a lógica da aplicação, incluindo:

* Autenticação segura com JWT + Refresh Token
* Criação e gerenciamento de posts
* Sistema de "Loved" (likes)
* Sistema de "ReMont" (repost)
* Sistema de seguidores (follow)
* Upload de imagens (Cloudflare R2)
* Feed personalizado
* Proteções contra abuso e conteúdo sensível

---

## 🛠️ Tecnologias

* Node.js
* NestJS
* TypeScript
* PostgreSQL
* Prisma ORM
* JWT Authentication
* Argon2 / Bcrypt
* Cloudflare R2
* Multer

---

## ⚙️ Configuração

### 1. Clone o projeto

```
git clone https://github.com/seu-user/moment-backend.git
cd moment-backend
```

### 2. Instale as dependências

```
npm install
```

### 3. Configure o .env

Crie um arquivo `.env` baseado no `.env.example`:

---

## 🧱 Banco de dados

```
npx prisma generate
npx prisma migrate dev
```

---

## ▶️ Rodando o projeto

```
npm run start:dev
```

Servidor:

```
http://localhost:3000
```

---

## 🔐 Segurança

* Hash de senha com Argon2
* JWT com refresh token
* Proteção de rotas com Guards
* Rate limit (Throttler)
* Filtro de conteúdo sensível
* Armazenamento seguro de arquivos

---

## 🧪 Testes de API

Use o **Insomnia** ou Postman para testar endpoints.

Fluxo recomendado:

1. Login
2. Refresh token
3. Get profile (auth)
4. Criar post
5. Curtir (Loved)
6. Seguir usuário
7. Feed

---

## 🚀 Deploy (visão futura)

* Docker
* Railway / VPS
* CDN para imagens (R2)
* Banco gerenciado (Supabase / Neon)

---

## 📌 Status

🚧 Em desenvolvimento (MVP avançado)

---

## 👨‍💻 Autor

**Caique Brandão**
Full Stack Developer
🔗 GitHub: https://github.com/brandaoca44
🔗 LinkedIn: https://www.linkedin.com/in/caique-brandão-47319537b
