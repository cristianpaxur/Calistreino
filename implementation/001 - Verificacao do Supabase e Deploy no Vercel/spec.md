# Verificação do Supabase e Deploy no Vercel

> **ID:** 001
> **Status:** 🟡 Planejada
> **Prioridade:** 🔴 Crítica
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Fechar a pendência técnica que impede o app de funcionar publicamente: validar o caminho de
acesso ao Supabase via API (PostgREST/supabase-js) contra o banco real, endurecer o acesso com
RLS e confirmar o deploy no Vercel sem erro 500/exception. É pré-requisito de tudo.

## 2. Contexto e Motivação

### 2.1 Problema Atual
O app migrou de SQLite → Postgres direto → API do Supabase. As duas tentativas anteriores de
deploy no Vercel falharam (500 por SQLite em serverless; depois exception). O caminho atual
(supabase-js) foi escrito e buildado, mas ainda **não foi testado ao vivo** nem o deploy confirmado.

### 2.2 Impacto do Problema
Sem isto, o produto não existe publicamente — nenhuma feature posterior tem onde rodar.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| API Supabase (supabase-js) | HTTPS, sem limite de conexão em serverless, sem IPv6 | Sem DDL, agregações em JS | ✅ Escolhida |
| Conexão TCP (pooler) | SQL puro | Fragilidade em serverless; usuário rejeitou | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Server Components / Server Actions → `@/lib/db` (cliente supabase-js, service_role, server-only) →
PostgREST. Schema gerenciado por `supabase/schema.sql` (a API não cria tabelas).

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `src/lib/db.ts` | Arquivo | Verificar | Cliente lazy + service_role |
| `src/lib/queries.ts` | Arquivo | Verificar | Queries sem embeds |
| `supabase/schema.sql` | Arquivo | Modificar | Adicionar habilitação de RLS |
| `.env`/Vercel | Config | Criar | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD`, `AUTH_SECRET` |

### 3.3 Interfaces e Contratos
#### Entradas
Variáveis de ambiente do Supabase e do app.
#### Saídas
App acessível na URL do Vercel, sem erro, com persistência real.
#### Contratos de API
N/A — uso interno do supabase-js.

### 3.4 Modelos de Dados
Tabelas `sessions`, `entries`, `settings` (já criadas). RLS habilitado sem políticas (service_role ignora).

### 3.5 Fluxo de Execução
1. Smoke test local com a service_role contra o Supabase do usuário (gravar treino + ler tudo + apagar).
2. Habilitar RLS no schema e aplicar.
3. Configurar envs no Vercel, dar push, redeploy.
4. Validar a URL pública (login, registrar treino, histórico, coach).

### 3.6 Tratamento de Erros
Erros de query lançam e aparecem nos logs do Vercel. `db.ts` lança mensagem clara se faltar env.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Gravar e ler treinos via API do Supabase em produção.
- **RF-002:** App público no Vercel sem erro 500/exception.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Acesso ao banco somente no servidor (service_role nunca no front).
- **RNF-002:** RLS habilitado (defesa em profundidade).

### 4.3 Restrições e Limitações
A API não executa DDL; schema fica em arquivo `.sql`.

## 5. Critérios de Aceitação
- [ ] **CA-001:** Smoke test passa contra o Supabase real (escrita + leitura + cascade).
- [ ] **CA-002:** RLS habilitado nas 3 tabelas.
- [ ] **CA-003:** Deploy no Vercel responde 200 na home autenticada e persiste um treino.
- [ ] **CA-004:** Variáveis de ambiente documentadas e configuradas no Vercel.

## 6. Plano de Testes
### 6.1 Testes Unitários
N/A — validação é de integração.
### 6.2 Testes de Integração
Script smoke (supabase-js) exercendo `insertWorkout` + queries + delete.
### 6.3 Testes de Aceitação
Fluxo manual na URL do Vercel: login → registrar → histórico → coach.
### 6.4 Casos de Borda
Banco vazio (0 sessões); env ausente (mensagem clara); senha do banco com caractere especial.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Sintaxe PostgREST incorreta | Baixa | Alto | Queries simples (sem embeds) + smoke test |
| service_role exposta no chat/repo | Média | Alto | Rotacionar chave; nunca commitar `.env.local` |
| RLS quebrar acesso | Baixa | Médio | service_role ignora RLS; testar após habilitar |

## 8. Dependências
### 8.1 Internas
Nenhuma (é a base).
### 8.2 Externas
Projeto Supabase ativo; conta Vercel conectada ao repositório.

## 9. Observações e Decisões de Design
A chave service_role apareceu no chat durante o desenvolvimento — recomendado rotacioná-la.
RLS sem políticas + acesso só por service_role é o padrão seguro para app server-only single-tenant
(será revisto na 002, quando houver multiusuário e políticas por `user_id`).
