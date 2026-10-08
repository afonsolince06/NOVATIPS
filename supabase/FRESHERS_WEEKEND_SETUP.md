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

Aplicar `migrations/20261005000700_unified_prediction_editor.sql` depois da 006 no projeto FDS. O Admin usa um único editor Normal/Mega Boost, com pré-visualização e imagem selecionada. `save_prediction` reutiliza `save_mega_boost` e mantém a validação e bloqueio de opções após apostas. Odd B vazia é calculada pela fórmula existente no cliente; cada boost é opcional e independente. Antes da migração 010, os rascunhos ficam no browser, sem publicar e sem guardar ficheiros locais de imagem. Depois da 010, o editor guarda rascunhos válidos no servidor, visíveis apenas aos admins. A resolução e redefinição de acesso continuam nas respetivas opções do Admin.

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

## Publicação agendada e Gestão de TIPS

No projeto **Supabase FDS**, depois da 009, executa uma vez e por ordem:

1. `migrations/20261005001000_scheduled_predictions.sql`
2. `migrations/20261005001100_admin_tips_grants.sql`

Atualiza o site após executar o SQL. O Admin verifica as capacidades instaladas: sem a 010, não disponibiliza agendamento e guarda rascunhos apenas no browser; sem a 011, não disponibiliza atribuições de TIPS. Não executes estas migrações no projeto antigo.

### Previsões

O editor Normal/Mega Boost continua único. **Publicação → Agora / Agendar** controla a visibilidade, enquanto **Fecha em** controla o fim das apostas. Os presets de fecho são calculados a partir da publicação agendada. Os campos usam a mesma função de hora local das Missões e enviam timestamps UTC.

- Admin → **Previsões**: filtros Rascunhos, Agendadas, Ativas, Fechadas e Resolvidas.
- Editar usa o editor existente. **Publicar agora** mantém o fecho; **Cancelar agendamento** move a previsão para rascunho.
- RLS bloqueia rascunhos/futuras nas consultas dos participantes. Os RPCs de aposta simples/múltipla também bloqueiam antes do início e depois do fecho.
- Os estados existentes `open/resolved/cancelled` são preservados. Agendada/Ativa/Fechada são calculados pelas datas; não há cron nem alteração da resolução.
- Depois de haver apostas, não é possível ocultar/reagendar a previsão nem alterar opções/odds.
- Rascunhos no servidor precisam de título, opções/odds válidas e janela de datas válida. Mega Boost só exige banner ao publicar.
- Continua a existir apenas um Mega Boost publicado com destaque ativo, incluindo uma reserva futura. Substituir essa reserva desativa o anterior mediante confirmação; rascunhos não reservam o destaque.
- As notificações Realtime existentes são preservadas: Postgres Changes aplica as políticas SELECT RLS ([documentação Supabase](https://supabase.com/docs/guides/realtime/authorization)). O cliente também não mostra toasts de futuras/rascunhos a admins. As consultas públicas recarregam a cada 15 segundos e ao regressar à janela. A autorização temporal é imediata no servidor; a aparição numa página já aberta ocorre na próxima consulta. Não são enviados push notifications ao guardar um rascunho/agendamento.

### Gestão de TIPS

Admin → **Gestão de TIPS** permite apenas atribuições positivas (1–1.000.000 TIPS por pessoa), com motivo obrigatório. Pesquisa de utilizadores reutiliza a das Missões, limitada aos destinatários elegíveis.

**Elegibilidade**, tanto para Utilizador como para Todos:

- perfil real ligado a uma conta Auth;
- email com acesso na lista FDS;
- conta não eliminada nem com bloqueio Auth ativo;
- elegibilidade manual permitida.

`freshers_weekend_access.manual_tips_eligible` é uma opção administrativa:
- `NULL`: participantes normais recebem; admins não recebem;
- `true`: incluir explicitamente, inclusive um admin que participe legitimamente;
- `false`: excluir, por exemplo uma conta de testes/organização.

A migração marca admins existentes como excluídos. Não havia um campo de conta de testes/sistema no modelo anterior; esta opção torna a exclusão explícita. Só alters esta opção no Supabase/servidor, nunca no perfil do participante.

Exemplo para incluir um admin participante ou excluir uma conta de testes:
```sql
UPDATE public.freshers_weekend_access
SET manual_tips_eligible = true -- false para excluir
WHERE email = 'numero@novaims.unl.pt';
```

A revisão mostra contagem real, total a distribuir e, para um utilizador, o saldo antes/depois. **Todos** exige escrever exatamente `CONFIRMAR`. Se os destinatários mudarem entre revisão e confirmação, a operação é recusada: cancela e revê uma nova atribuição.

Os saldos atualizam `profiles.balance`, com bloqueios de linhas e uma única transação. `admin_tips_grant_batches` regista motivo/admin/montante/destinatários e `admin_tips_grant_entries` regista cada crédito `ADMIN_GRANT`, incluindo saldos antes/depois. Identificadores e nomes de auditoria sobrevivem à eliminação posterior de contas. O histórico Admin mostra as últimas 50 operações concluídas, sem emails.

Cada revisão tem um identificador estável. Duplo clique ou repetição do pedido de confirmação devolve a mesma atribuição, sem pagar novamente. Uma nova operação deliberada cria outro identificador. Falhas no lote/auditoria anulam todos os créditos. Não foi criado um segundo saldo nem reescrita a contabilidade das apostas/Missões.

### Testes

- `node --test tests/*.test.mjs`: horários exatos, estados, fórmula de odds, Mega Boost, ranking, histórico e Missões.
- Com PGlite instalado conforme a secção anterior: `node tests/admin-scheduling-tips.database.mjs`. Carrega todas as migrações numa base em memória e testa RLS de futuras/rascunhos, aposta simples/múltipla antes do início, edição/publicação/cancelamento, fecho/resolução, Mega Boost, atribuição única/lote, idempotência, elegibilidade, rollback e permissões.
- Antes de usar com participantes reais, testa com duas contas: uma admin e outra normal. Confirma que a segunda não consegue consultar uma previsão futura por ID, que +500 aparece uma só vez e que o bónus Todos altera apenas contas elegíveis.

## Casas FDS e onboarding — ativação

No **Supabase FDS**, depois da 011, executa uma vez migrations/20261005001200_fds_houses_and_onboarding.sql e atualiza a página. O painel Casas verifica a capacidade instalada; antes do SQL não altera registos nem força onboarding. A edição antiga mantém a navegação habitual.

### Lista oficial e importação

O PDF e as imagens têm **105 participantes e 18 casas**, incluindo Casa 14. O ficheiro local private-imports/fds-houses-import.json contém 104 correspondências seguras e uma pendente; private-imports/fds-houses-matching-report.md documenta o cruzamento. Estes ficheiros privados são ignorados pelo Git e não entram no bundle público.

- Luís Sousa 20241805 → Casa 4 foi confirmado pelo organizador; o outro Luís Sousa, 20261457, corresponde à Casa 7.
- Ana Marroquin → Casa 9 permanece por confirmar: o PDF repete Marroquin nos dois campos, com candidato 20261266. Não é atribuída automaticamente.
- Os restantes nomes foram comparados exatamente após normalizar acentos, apóstrofos e espaços. Não houve aproximação por nome parecido.

Para preencher a lista inicial diretamente, executa o ficheiro privado **private-imports/seed-fds-houses.sql** no SQL Editor FDS depois da migração 012. Insere as 104 correspondências confirmadas em fds_house_roster e liga contas existentes pelo número; contas futuras recebem a atribuição ao registar. Pode ser repetido, preserva conflitos e correções manuais e não altera contas/TIPS. O resumo final mostra atribuições aceites e conflitos preservados. A auditoria identifica este bootstrap SQL com UUID zero e source=official_sql_seed, sem o atribuir a uma pessoa. Atualiza a página depois do Run. Não publiques este ficheiro com os dados pessoais.

A importação JSON é uma alternativa para listas novas, na secção recolhida **Atualizar lista oficial (avançado)**. Não é necessária para guardar correções. Em **Admin → Casas**, carrega o JSON, escolhe **Pré-visualizar** e revê antes de **Confirmar importação das correspondências seguras**. O servidor usa o número de aluno. Duplicados, conflitos e nomes por resolver ficam de fora. Repetir a mesma confirmação não duplica atribuições. Se as casas mudarem entre revisão e confirmação, é necessário rever novamente.

A importação não cria contas, não altera a allowlist e não atribui TIPS. Pessoas sem conta ficam como **Sem conta**, com a atribuição guardada no roster; ao registarem-se com o email institucional autorizado, recebem a casa oficial. Registo e importação partilham o bloqueio transacional para evitar perdas em registos simultâneos.

**Alterar casa** abre uma janela com seleção, Cancelar e Guardar casa; a confirmação aparece junto ao utilizador. A gravação usa admin_set_user_house no Supabase.

O Admin vê contas e membros à espera de conta, procura por número/username/Instagram/nome oficial e guarda correções com intenção explícita. **Sem casa** também é uma correção válida; importações posteriores preservam-na. As alterações ficam registadas em fds_house_changes. Para resolver Ana, confirma a identidade e atribui Casa 9 ao número correto; também podes corrigir o JSON e rever outra importação.

### Classificação e elegibilidade

O ranking Individual mantém TIPS → acertos → taxa de acerto; a casa é informação secundária. Individual / Casas são modos da mesma página. O perfil mostra a casa sem edição pelo participante.

O ranking das casas é calculado no servidor a partir de profiles.balance, sem outro saldo. Usa **a mesma elegibilidade dos bónus manuais**: conta real com acesso FDS, não eliminada/bloqueada e manual_tips_eligible permitido. Admins participantes precisam de manual_tips_eligible=true; contas de organização/testes podem ficar com false. Importar uma casa não altera esta opção automaticamente.

- Regra inicial: **média de TIPS por membro elegível com conta criada**. Pessoas sem conta não entram no denominador nem recebem saldo fictício. O Admin distingue membros oficiais, contas criadas e elegíveis.
- Admin → Casas → Regra permite mudar explicitamente para **total**.
- Mostra score, total e membros. Empates de score exato partilham posição, sem desempate oculto. A apresentação arredonda a duas casas decimais; a posição usa a precisão SQL.
- Casas sem contas elegíveis aparecem sem posição.
- Apostas, Missões e atribuições Admin afetam automaticamente a classificação. Rankings e detalhes recarregam a cada 30 segundos; a classificação também ao voltar à janela.

### Onboarding e guia

Quatro passos com Começar/Seguinte/Voltar/Saltar. Concluir **ou saltar** grava onboarding_version_seen=1 numa tabela por conta, não em metadados Auth. Outra sessão/dispositivo não volta a forçar a apresentação. Em falha de rede, a pessoa continua e uma fila local por conta repete a gravação destas preferências.

**Como funciona** está no perfil, menu mobile e botão ? da navbar desktop. **Rever apresentação** não reinicia o estado. Mega Boost, Flash e Casas têm ajudas dispensáveis, persistidas independentemente. Não interferem com apostas/recompensas; a mudança obrigatória de password mantém prioridade. Não existe reset global: a versão torna-o desnecessário na V1. O Admin é carregado à parte, apenas quando é aberto.

### Verificação

node tests/admin-scheduling-tips.database.mjs carrega todas as migrações numa base isolada e verifica importação por identificador, conflitos/correções, registo futuro, permissões, média/total/empates, recompensas de Missões e Admin, persistência por conta e regressões de apostas/agendamento. Os testes locais de browser usam dados simulados e verificam completar/saltar/reabrir onboarding, ajudas uma vez, perfil/guia, ranking, revisão antes de importar e mobile sem overflow.

Depois de ativar, testar com conta Admin e conta normal: importar com revisão, confirmar casa pelo número, tentar alterar a própria casa (deve falhar), confirmar média/total após recompensa, saltar onboarding e voltar a entrar, reabrir Como funciona. Os testes locais não substituem a validação nas contas reais.

## Participação nas Missões (migração 013)

Depois da migração 012, executa `migrations/20261008000100_mission_self_participation.sql` no **Supabase FDS** antes de publicar a interface. Usa a tabela existente `fds_mission_participations`: o participante inscreve-se uma vez, a equipa assinala a prova recebida no Instagram e confirma o vencedor antes de creditar TIPS. A validação e o crédito usam a transação e os limites de vagas já existentes. A inscrição por si só não dá TIPS nem define a ordem dos vencedores. O Admin vê o número de participantes, provas e premiados e pode pesquisar/filtrar a lista privada. A V1 não inclui cancelamento pelo participante; a participação fica no histórico da missão.
