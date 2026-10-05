# Edição Fds do Caloiro: configuração

Esta edição usa o mesmo frontend, mas deve ser publicada como uma aplicação Vercel separada e ligada a um projeto Supabase novo. Não ligues esta edição ao projeto Supabase do site atual: a separação do projeto é o que mantém apostas, contas e saldos independentes.

## 1. Criar e preparar o Supabase

1. Cria um projeto Supabase novo para a edição do FDS.
2. No SQL Editor desse projeto, executa `migrations/20261004000200_freshers_weekend_core.sql` uma vez.
3. Executa `migrations/20261004000300_admin_password_reset_audit.sql`, `migrations/20261004000400_bet_deadlines.sql` e `migrations/20261005000100_bet_sections.sql`, uma vez cada e por esta ordem. A primeira adiciona auditoria e reset seguro, a segunda prazos de fecho reais e a terceira a categoria de cada aposta.
4. Antes de permitir registos, adiciona o email do administrador e os emails dos participantes à allowlist. Substitui os exemplos e executa o bloco no SQL Editor:

```sql
INSERT INTO public.freshers_weekend_access (email, is_admin)
VALUES
  ('admin@novaims.unl.pt', true),
  ('participante1@novaims.unl.pt', false),
  ('participante2@novaims.unl.pt', false)
ON CONFLICT (email) DO UPDATE SET is_admin = EXCLUDED.is_admin;
```

Confirma que o provider de email/password está ativo e desativa **Confirm email** em Authentication > Sign In / Providers > Email no projeto FDS. Os novos registos entram imediatamente, sem email de confirmação. A recuperação de acesso é feita pela organização através da função administrativa; a interface FDS não envia emails de recuperação. Não alteres a configuração do projeto antigo.

Contas antigas ainda não confirmadas devem ser revistas e confirmadas individualmente em Authentication > Users antes de testar o login.

Depois da migration 003, aplica também `migrations/20261005000200_fix_forced_password_change.sql` para corrigir o trigger de mudança obrigatória de password. Não voltes a executar a migration 003.

Os emails têm de estar em minúsculas. O trigger de autenticação só permite registos de emails `@novaims.unl.pt` que já estejam nesta lista. O primeiro saldo de cada conta é 2.500 TIPS. O campo `is_admin` é a autorização real no servidor para criar, resolver e apagar apostas.

Se já executaste as migrations `002`, `003` e `004` neste projeto, **não as voltes a executar**. Executa apenas `005` no SQL Editor para adicionar a categoria das apostas.

Na edição FDS, o separador Admin consulta o papel `is_admin` no Supabase novo; não é preciso alterar a lista de administradores usada pelo site antigo. As funções SQL também validam esse papel no servidor.

## Reset administrativo de password

1. No projeto Supabase novo, abre **Edge Functions**, cria a função `admin-reset-password`, copia o conteúdo de `functions/admin-reset-password/index.ts` e faz deploy. Mantém a verificação JWT ativa. A função usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do próprio projeto; o Supabase disponibiliza esses secrets às Edge Functions.
2. Publica esta função antes de fazer redeploy do site Vercel.
3. No separador Admin, introduz o email institucional exato do participante e confirma que verificaste a identidade da pessoa.
4. A password temporária aparece uma única vez no painel. Envia-a apenas à pessoa por um canal privado e pede-lhe que a altere no perfil assim que entrar. Não a guardes nem a publiques.

A função confirma o JWT, verifica `is_admin` na allowlist no servidor, aceita apenas contas de participantes autorizados e regista a ação sem guardar a password. Revoga as refresh sessions da conta alvo; access tokens já emitidos podem continuar válidos até expirarem. A password temporária é obrigatoriamente substituída na próxima entrada. Nunca coloques a `service_role` key no frontend ou nas variáveis `VITE_*`.

## 2. Criar uma publicação Vercel separada

1. Importa o mesmo repositório como um projeto Vercel novo, com um nome e domínio próprios para o FDS.
2. Mantém o framework Vite, comando de build `npm run build` e diretório de saída `dist`.
3. Nas variáveis de ambiente desse projeto, define:
   - `VITE_SITE_EDITION` = `freshers-weekend`
   - `VITE_FDS_SUPABASE_URL` = URL do projeto Supabase novo
   - `VITE_FDS_SUPABASE_ANON_KEY` = chave anon/public desse projeto
4. Não substituas as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do projeto Vercel antigo.
5. Em Supabase > Authentication > URL Configuration, define o domínio novo como Site URL e adiciona-o às Redirect URLs.
6. Faz redeploy do projeto Vercel do FDS após definir as variáveis.

`VITE_FDS_SUPABASE_ANON_KEY` é uma chave pública para o browser; nunca uses a `service_role` key no frontend, em ficheiros `.env` publicados ou no Vercel client-side.

## 3. Dados e funcionalidades

- Contas, apostas, referrals e saldos desta edição ficam no projeto Supabase novo.
- O schema cria o ranking sem emails, restringe acesso aos convidados e valida as apostas no servidor.
- Cada aposta guarda um prazo real. O formulário aceita durações como `24h`, `2h 30m` e `3d`, e o servidor recusa apostas depois do prazo.
- O formulário Admin permite escolher entre Desenhos Animados, Neon Party, Rally das Casas, Gerais e Especiais. As apostas aparecem agrupadas na secção selecionada.
- A lista de convidados não é exposta aos outros participantes; gere-a no SQL Editor/Supabase Dashboard.
- Push notifications são opcionais. Para as ativar, configura a chave VAPID pública e publica a Edge Function de notificações no projeto Supabase novo.
- `schema.sql` é apenas um índice informativo. Não o executes como script de instalação.
