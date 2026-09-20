import { Redis } from '@upstash/redis';

export const DEFAULT_SETORES = [
  'Frios', 'Hortifruti', 'Massas', 'Biscoitos', 'Limpeza',
  'Mercearia', 'Bebidas', 'Açougue', 'Padaria', 'Laticínios'
];

export const DEFAULT_ENCARREGADOS = ['Pedro', 'Ellen', 'Fernando'];

export const DEFAULT_PRODUTOS = {
  'Frios': ['Presunto', 'Mussarela', 'Salame', 'Mortadela', 'Peito de Peru'],
  'Hortifruti': ['Tomate', 'Alface', 'Banana', 'Maçã', 'Batata', 'Cebola'],
  'Massas': ['Macarrão Espaguete', 'Macarrão Parafuso', 'Lasanha', 'Molho de Tomate'],
  'Biscoitos': ['Biscoito Recheado', 'Biscoito Água e Sal', 'Bolacha Maisena', 'Wafer'],
  'Limpeza': ['Detergente', 'Sabão em Pó', 'Água Sanitária', 'Desinfetante', 'Amaciante'],
  'Mercearia': ['Arroz', 'Feijão', 'Açúcar', 'Óleo de Soja', 'Café', 'Sal'],
  'Bebidas': ['Refrigerante Cola', 'Suco de Laranja', 'Água Mineral', 'Cerveja'],
  'Açougue': ['Carne Moída', 'Picanha', 'Frango Inteiro', 'Linguiça'],
  'Padaria': ['Pão Francês', 'Pão de Forma', 'Pão Doce'],
  'Laticínios': ['Leite Integral', 'Iogurte', 'Manteiga', 'Requeijão']
};

const CONFIG_KEY = 'central_reposicao:config';
const COMANDAS_KEY = 'central_reposicao:comandas';

// Aceita tanto as variáveis clássicas do Vercel KV quanto as do
// Upstash Redis (Vercel Marketplace), para funcionar com qualquer uma
// das duas formas de conectar o banco.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let redis = null;
function getRedis() {
  if (!redis) {
    if (!url || !token) {
      throw new Error(
        'Banco de dados não conectado. Crie um banco Redis (Storage > Create Database) ' +
        'no painel da Vercel e conecte ao projeto — veja o README.'
      );
    }
    redis = new Redis({ url, token });
  }
  return redis;
}

// Garante que a config exista no banco. Nunca sobrescreve o que já foi
// salvo — só cria na primeira vez que o sistema roda (assim, setores e
// produtos adicionados pelo encarregado nunca somem).
export async function getConfig() {
  const client = getRedis();
  let config = await client.get(CONFIG_KEY);
  if (!config) {
    config = {
      setores: DEFAULT_SETORES,
      encarregados: DEFAULT_ENCARREGADOS,
      repositores: [],
      produtos: DEFAULT_PRODUTOS
    };
    await client.set(CONFIG_KEY, config);
  }
  // garante que campos novos existam mesmo em bancos antigos
  config.setores = config.setores || [];
  config.encarregados = config.encarregados || [];
  config.repositores = config.repositores || [];
  config.produtos = config.produtos || {};
  return config;
}

export async function saveConfig(config) {
  await getRedis().set(CONFIG_KEY, config);
  return config;
}

export async function getComandas() {
  const list = await getRedis().get(COMANDAS_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveComandas(list) {
  await getRedis().set(COMANDAS_KEY, list);
  return list;
}
