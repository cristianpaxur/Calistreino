# Contas de Usuário e Autenticação (Multi-Tenant)

> **ID:** 002
> **Status:** 🔵 Em Andamento (código completo + build verde; aguardando portões humanos para rodar ao vivo)
> **Prioridade:** 🔴 Crítica
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Substituir a autenticação por senha única compartilhada por **contas de usuário reais** (Supabase Auth),
isolando todos os dados por `user_id` com Row Level Security. É a fundação que transforma o app
pessoal em produto multiusuário.

## 2. Contexto e Motivação

### 2.1 Problema Atual
Hoje o acesso é uma senha única (`APP_PASSWORD`) e todos os dados são globais (sem dono). Impossível
ter mais de uma pessoa.

### 2.2 Impacto do Problema
Sem contas, não há produto — qualquer usuário veria/editaria os dados de todos.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Supabase Auth | Integra com o banco já usado; RLS por `auth.uid()`; e-mail/OAuth prontos | Acoplado ao Supabase | ✅ Escolhida |
| Auth.js (NextAuth) | Flexível | Mais glue; sessão/usuário separados do banco | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Supabase Auth gerencia usuários. As tabelas ganham `user_id uuid` referenciando `auth.users`.
Acesso passa a usar o cliente Supabase **com o token do usuário** (RLS por `auth.uid()`), em vez da
service_role global. Middleware do Next protege rotas via sessão do Supabase (cookies).

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `supabase/schema.sql` | Arquivo | Modificar | Add `user_id` + políticas RLS por usuário |
| `src/lib/db.ts` | Arquivo | Modificar | Cliente por-request com sessão do usuário |
| `src/lib/auth.ts` | Arquivo | Substituir | Sessão Supabase no lugar do cookie HMAC |
| `src/middleware.ts` | Arquivo | Modificar | Proteção via sessão Supabase |
| `src/app/login/*` | Arquivo | Substituir | Login/cadastro de e-mail (e OAuth) |
| `src/app/actions.ts`, `queries.ts` | Arquivo | Modificar | Escopar por `user_id` (via RLS) |

### 3.3 Interfaces e Contratos
#### Entradas
E-mail/senha (ou OAuth) no login/cadastro.
#### Saídas
Sessão autenticada (cookies Supabase); dados filtrados ao usuário logado.
#### Contratos de API
Supabase Auth (`signUp`, `signInWithPassword`, `signOut`, `getUser`).

### 3.4 Modelos de Dados
`sessions`, `entries`, `settings` ganham `user_id uuid not null default auth.uid()`. Políticas RLS:
`using (user_id = auth.uid())` para select/insert/update/delete. `settings` vira por usuário (PK composta `user_id,key`).

### 3.5 Fluxo de Execução
1. Usuário se cadastra/loga → sessão Supabase em cookie.
2. Server Components/Actions criam cliente Supabase com o cookie da request.
3. RLS garante que cada um só vê o seu.

### 3.6 Tratamento de Erros
Falha de login → mensagem clara. Sessão expirada → redireciona para login. Erro de RLS → 403 tratado.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Cadastro e login por e-mail/senha.
- **RF-002:** Logout.
- **RF-003:** Cada usuário só acessa os próprios dados (sessões, entradas, settings).
- **RF-004:** Migrar os dados existentes (do usuário-piloto) para uma conta.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Isolamento garantido por RLS (não só por filtro de aplicação).
- **RNF-002:** Sessão segura (cookies httpOnly do Supabase).

### 4.3 Restrições e Limitações
Manter compatível com o runtime atual (Server Components).

## 5. Critérios de Aceitação
- [ ] **CA-001:** Dois usuários distintos não veem os dados um do outro (verificado).
- [ ] **CA-002:** Cadastro, login e logout funcionam.
- [ ] **CA-003:** Dados antigos migrados para uma conta sem perda.
- [ ] **CA-004:** RLS ativo e testado (acesso sem sessão é negado).

## 6. Plano de Testes
### 6.1 Testes Unitários
Helpers de criação de cliente por-request.
### 6.2 Testes de Integração
Criar 2 contas, gravar treinos em cada, confirmar isolamento via RLS.
### 6.3 Testes de Aceitação
Fluxo cadastro→login→registrar→logout→login.
### 6.4 Casos de Borda
Acesso sem sessão; e-mail duplicado; token expirado.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| RLS mal configurado vaza dados | Média | Alto | Testes explícitos de isolamento com 2 contas |
| Quebrar runtime ao trocar de service_role para sessão | Média | Médio | Migrar query por query; manter testes |
| Migração de dados existentes | Baixa | Médio | Script idempotente; backup antes |

## 8. Dependências
### 8.1 Internas
001 (Supabase/deploy estável).
### 8.2 Externas
Supabase Auth (já incluso no projeto Supabase).

## 9. Observações e Decisões de Design
Trocar a service_role pelo cliente com sessão do usuário é o que ativa o RLS por `auth.uid()`.
A service_role passa a ser usada só em operações administrativas/server-only sem contexto de usuário
(ex.: seed da biblioteca na 005). O cookie HMAC e `APP_PASSWORD` são removidos.
