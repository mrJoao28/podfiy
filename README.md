# Podfiy

App pessoal de podcasts em pt-BR. Next.js App Router, TypeScript estrito, Tailwind, IndexedDB e Supabase. Áudio original, sem servidor de streaming próprio e sem APIs pagas.

**Validação:** 12 testes unitários de sequência, top 5, tempo ouvido, agregação semanal/mensal e RSS; TypeScript estrito e build de produção. O teste de navegador usa Chrome local e dados simulados, sem acessar sua biblioteca pessoal. Login/sincronização com a conta real e reprodução com tela bloqueada precisam de verificação no seu dispositivo. Não houve deploy na Vercel nem execução remota da migração.

## Rodar

Node 22 LTS ou superior. No Windows use `npm.cmd` caso o PowerShell bloqueie `npm.ps1`.

```sh
npm install
npm run dev
```

Abra http://localhost:3000. O `.env` existente é preservado e ignorado no Git; `.env.example` documenta os nomes. Sem Supabase configurado, a biblioteca funciona em IndexedDB. Dados do modo local e de cada conta são separados. Exportação JSON disponível em Config.

## Supabase gratuito

1. No dashboard do seu projeto, abra **SQL Editor → New query** e execute `supabase/migrations/001_initial.sql` inteiro. Cria sete tabelas com RLS e acesso restrito ao proprietário.
2. Em **Authentication → Providers → Email**, habilite login por e-mail. Em **URL Configuration**, configure Site URL com seu domínio e adicione `http://localhost:3000/**` e `https://SEU-APP.vercel.app/**` nos Redirect URLs.
3. Use `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` não é utilizada pelo app e nunca deve receber prefixo público.
4. Em Config, envie o magic link. Abra o e-mail no mesmo navegador em que pretende usar o app. Repita no celular para sincronizar a mesma conta.

IndexedDB salva localmente; alterações são enviadas após três segundos. Use “Sincronizar agora” ao alternar dispositivos. Progresso de episódios usa a atualização mais recente e sessões se unem por UUID. Assinaturas, favoritos, fila e configurações usam snapshots: alterações simultâneas em dois dispositivos podem se sobrepor. Não é sincronização colaborativa em tempo real.

## PWA no Android

Publique em HTTPS. No Chrome Android, abra o app → menu ⋮ → Adicionar à tela inicial → Instalar. Inicie o áudio com um toque antes de bloquear a tela. O único `<audio>` fica no layout raiz; Media Session expõe play/pause, saltos, anterior/próximo e seek. A manutenção do processo também depende das políticas de bateria do Android e da disponibilidade do servidor de áudio.

O service worker guarda ícones e arquivos estáticos; navegação sem rede mostra uma página offline. O app aberto mantém a biblioteca em IndexedDB. Não baixa áudios nem garante reabertura completa do app offline. Feeds HTTP podem ser lidos pelo proxy, mas áudio HTTP pode ser bloqueado em um site HTTPS.

## Verificação

```sh
npm test
npm run typecheck
npm run build
```

Testes cobrem duração, RSS/enclosure/CDATA, rejeição de entidades, sequência no fuso America/Manaus e top 5 por intervalo. `node scripts/icons.mjs` regenera os ícones PNG sem dependências. Fonte Inter usa Google Fonts com fallback de sistema.

Para a checagem local de interface, inicie `npm run dev -- --port 3100` e, em outro terminal, execute `npm run test:browser`. O script usa Chrome headless em um perfil isolado dentro de `.qa/`, testa fluxos com um feed e áudio locais e salva capturas nessa pasta (ignorada pelo Git). `PODFIY_CHROME` permite escolher outro caminho do Chrome; `PODFIY_URL` permite mudar a URL local. Não instala dependências de navegador.

O player abre como folha no celular, com foco contido e retorno ao controle de origem. O anel permite arrastar e usar setas/Home/End; a busca no áudio é confirmada ao soltar. Episódios aparecem em lotes de 20 com “Carregar mais”; filtros reiniciam a contagem. A aba Fila permanece na URL. A meta diária fica visível no celular e nas estatísticas, com aviso discreto ao ser atingida.

Teste manual em Android: instalar; tocar; bloquear a tela; pausar/retomar e saltar pela notificação; navegar pelas abas; avançar ao fim com fila; colocar timer; reabrir e verificar posição; entrar com a mesma conta em outro dispositivo. Medição registra segundos reais de avanço, exclui pausas e saltos; velocidade não multiplica horas ouvidas. Meta padrão: cinco minutos por dia em Manaus.

## Deploy gratuito na Vercel

1. Envie este projeto a um repositório Git e importe na Vercel, usando o plano Hobby e o preset Next.js, dentro das cotas gratuitas. Não é necessário contratar serviço pago.
2. Cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` nas Environment Variables, antes do build. A service role não é necessária na Vercel.
3. Faça Deploy e cadastre o domínio final nos Redirect URLs do Supabase. Refaça o deploy se mudar variáveis públicas.

O deploy depende do acesso à sua conta Vercel; as migrações dependem do SQL Editor do seu Supabase. Nenhuma assinatura ou cobrança é criada pelo código.

Busca iTunes pelo servidor: debounce 400 ms, cache 30 min, proteção de 18 buscas/min por instância e mensagens para 403/429. RSS tem cache de 20 min, limite de 8 MB, timeout, validação de URLs públicas e de redirecionamentos. Cache/limite em memória podem reiniciar e não são compartilhados entre instâncias serverless. Feeds ou áudios indisponíveis nos provedores podem falhar.

## Etapas do código

1. Base, design, manifest, service worker, ícones, IndexedDB e autenticação.
2. Busca iTunes, RSS direto e página do podcast.
3. Player persistente, Media Session, posição, velocidade e timer.
4. Biblioteca, corações, histórico e fila reordenável.
5. Sequência, heatmap, horas e top 5 com filtros.
6. Estados de erro/carregamento, testes e documentação.
