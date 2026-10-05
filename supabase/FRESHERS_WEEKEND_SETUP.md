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

## Mega Boost

Executa uma vez `migrations/20261005000400_mega_boost.sql` no projeto FDS. A migration adiciona metadados à tabela bets, a função administrativa save_mega_boost e o bucket público prediction-images (JPG/PNG/WebP, máximo 5 MB, upload exclusivo de administradores). Não usa novas categorias nem altera as funções de apostas/resolução.

No Admin, abre Mega Boost para criar ou selecionar uma previsão existente, carregar imagem, definir título, descrição, Sim/Não, fecho na hora local, badge e odd boosted opcional para Sim. Marca Ativo para destacar. Só existe um ativo; substituir exige confirmação. Depois de haver apostas não podes alterar as opções/odds. Desativar ou expirar retira o destaque mas mantém a previsão no evento interno, histórico e resolução.

Testar com duas contas: criar inativo, ativar, selecionar Sim/Não, colocar aposta, verificar retorno, confirmar bloqueio de edição de odds, substituir outro ativo, desativar, expirar e resolver no painel habitual. Confirmar que participantes não conseguem usar save_mega_boost ou fazer upload.


### Editor unificado do Admin

Aplicar `migrations/20261005000700_unified_prediction_editor.sql` depois da 006 no projeto FDS. O Admin usa um único editor Normal/Mega Boost, com pré-visualização e imagem selecionada. `save_prediction` reutiliza `save_mega_boost` e mantém a validação e bloqueio de opções após apostas. Odd B vazia é calculada pela fórmula existente no cliente; cada boost é opcional e independente. Rascunhos ficam apenas no browser, sem publicar e sem guardar ficheiros locais de imagem. A resolução e redefinição de acesso continuam nas respetivas opções do Admin.

## Missões FDS — ativação

Executa uma vez a migration `migrations/20261005000900_fds_missions.sql` no SQL Editor do **projeto Supabase FDS**, depois da 008. Reutiliza o bucket `prediction-images` da 004. Não altera autenticação, apostas, odds ou funções de resolução. Não cria missões nem participantes de demonstração.

- Navbar → Missões: desafios, filtros, destaque/Flash, detalhe, countdown e histórico pessoal.
- Admin → Missões: criar/editar, rascunhar, agendar, publicar, pausar, fechar, concluir, carregar banner e gerir participações. O Flash abre com 30 minutos, Race e 5 premiados; tudo é editável.
- Perfil: Instagram opcional, guardado como handle sem @ nem URL; pesquisa administrativa por nome, número de aluno ou Instagram.
- Normal: cada aprovação confirmada paga a recompensa. Race: as primeiras X aprovações confirmadas recebem; a ordem de aprovação define as vagas. Competição: validar participação não paga; fecha a missão e escolhe os vencedores para pagar.
- Novas participações só podem ser registadas durante o período ativo. Provas são recebidas fora do site. Participações registadas a tempo podem ser revistas após o fecho. Pausar ou concluir bloqueia a revisão.
- Os horários são introduzidos na hora local e enviados como timestamps UTC. O servidor valida início/fim; o countdown e os estados públicos atualizam sem cron jobs.

As recompensas atualizam **profiles.balance**, com bloqueio transacional e registo auditável em `fds_mission_rewards` (tipo MISSION_REWARD, missão, participante, admin, montante e saldo antes/depois). Uma participação por pessoa/missão e uma recompensa por participação. Falhas no registo de auditoria anulam também o crédito. RLS permite aos participantes ver apenas as suas participações/recompensas; funções de escrita verificam o papel Admin no servidor.

O saldo é atualizado após operações do Admin e ao mudar de separador. Durante a sessão FDS, saldo e leaderboard também recarregam a cada 30 segundos e ao regressar à janela. Não é necessária uma nova publicação Realtime.

### Validação antes de partilhar

1. Cria Normal +200; regista uma conta de teste, aprova e confirma o saldo +200 no perfil/leaderboard. Tentar aprovar de novo deve ser bloqueado.
2. Cria Race com 3 vagas; regista 4 participantes antes do fecho. Só os primeiros 3 aprovados recebem.
3. Cria Competição com 1 vencedor; valida duas participações sem alteração de saldo. Fecha, seleciona um vencedor e confirma; só este recebe.
4. Lança Flash; verifica destaque e countdown. Após o fim, adicionar participantes deve falhar.
5. Agenda uma missão; antes do início não aceita participantes, depois aceita automaticamente.
6. Guarda @username no Perfil e procura o utilizador por esse handle no Admin.
7. Testa criar/apostar/resolver uma previsão normal, Mega Boost, My Bets e logout/login, com duas contas reais no FDS.

Testes automáticos locais: `node --test tests/*.test.mjs`. Para testar SQL numa base PostgreSQL isolada, sem tocar no Supabase: `npm install --prefix .tmp/mission-sql --no-save --no-package-lock @electric-sql/pglite`, seguido de `node tests/missions.database.mjs`. O teste cria apenas fixtures na memória e fecha a base no fim.
