# Central de Reposição

Sistema de requisições entre **encarregados** (azul) e **repositores** (vermelho) de supermercado.
Quando falta um produto no setor, o encarregado monta a requisição (setor + produtos + observação) e ela chega
como uma **comanda** para os repositores, que a assumem, separam item a item e concluem.

Tudo fica salvo em um banco de dados de verdade (Vercel KV), então:

- Os dados aparecem para todo mundo, em qualquer aparelho (o app busca atualizações a cada 3 segundos).
- Setores e produtos que você cadastrar **nunca somem** — ficam salvos para sempre no banco.
- Toda requisição (concluída ou não) fica guardada no histórico, com todos os itens pedidos, quem pegou,
  quando foi concluída, etc. Basta clicar em uma comanda para ver o detalhamento completo.

## 1. Subir o projeto no GitHub

```bash
cd central-reposicao
git init
git add .
git commit -m "Central de Reposição"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/central-reposicao.git
git push -u origin main
```

## 2. Importar no Vercel

1. Acesse [vercel.com/new](https://vercel.com/new) e importe o repositório que você acabou de subir.
2. Não é preciso configurar nada no "Build" — o Vercel detecta automaticamente que é um projeto Next.js.
3. Clique em **Deploy**. Ele vai terminar com erro na primeira vez (ou funcionar sem salvar nada) porque
   ainda falta o banco de dados — é o próximo passo.

## 3. Criar o banco de dados (Vercel KV)

Isso é o que faz os dados ficarem salvos de verdade (histórico, setores, produtos) e serem os mesmos
para encarregados e repositores em qualquer aparelho.

1. No painel do seu projeto na Vercel, vá na aba **Storage**.
2. Clique em **Create Database** → escolha **KV** (Upstash for Redis, gratuito no plano Hobby).
3. Dê um nome (ex: `central-reposicao-db`) e crie.
4. Na tela seguinte, clique em **Connect Project** e selecione o projeto `central-reposicao`.
   Isso adiciona automaticamente as variáveis de ambiente (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc).
5. Volte na aba **Deployments** e clique em **Redeploy** no último deploy (agora com o banco conectado).

Pronto — o link do seu projeto (ex: `https://central-reposicao.vercel.app`) já funciona igual ao protótipo,
só que os dados ficam permanentes e compartilhados entre todos os aparelhos.

## 4. Rodar localmente (opcional)

```bash
npm install -g vercel   # se ainda não tiver
vercel link             # conecta esta pasta ao projeto criado na Vercel
vercel env pull .env.local   # baixa as variáveis do banco (KV) para rodar local
npm install
npm run dev
```

Abra http://localhost:3000

## Estrutura do projeto

```
pages/
  index.js              -> toda a interface (encarregado + repositor)
  api/config.js          -> setores, encarregados, repositores, produtos (persistente)
  api/comandas/index.js  -> listar e criar comandas
  api/comandas/[id].js   -> pegar, marcar item, concluir, cancelar
lib/kv.js                -> acesso ao banco (Vercel KV) e listas padrão
styles/globals.css       -> visual (azul = encarregados, vermelho = repositores)
public/logo.png          -> a logo do mercado
```

## Como funciona por dentro

- Todas as requisições ("comandas") ficam guardadas para sempre no banco, com status
  `pendente` → `separando` → `concluida` (ou `cancelada`). Nada é apagado, então tanto o
  encarregado quanto o repositor sempre podem abrir uma comanda antiga e ver exatamente o que
  foi pedido, quem pegou e quando foi concluída.
- Adicionar um setor ou um produto novo grava direto no banco (`pages/api/config.js`), então
  fica disponível para sempre, em qualquer aparelho, para qualquer encarregado.
- A tela atualiza sozinha a cada 3 segundos (`POLL_MS` em `pages/index.js`). Se quiser atualização
  instantânea (tipo WebSocket), dá para trocar depois por Pusher, Ably ou Supabase Realtime — mas
  para o volume de uma loja isso já funciona bem no dia a dia.

## Personalizar

- Trocar a logo: substitua `public/logo.png`.
- Trocar as cores: edite as variáveis `--blue-*` e `--red-*` no topo de `styles/globals.css`.
- Trocar os setores/produtos iniciais: edite `DEFAULT_SETORES`, `DEFAULT_ENCARREGADOS` e
  `DEFAULT_PRODUTOS` em `lib/kv.js` (isso só vale para a primeira vez que o banco é criado —
  depois disso, o que estiver salvo no banco sempre tem prioridade).
