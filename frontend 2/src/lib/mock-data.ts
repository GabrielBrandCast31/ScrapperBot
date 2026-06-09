export type Sentiment = "positive" | "neutral" | "negative";
export type Health = "healthy" | "attention" | "risk";

export interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastAt: string;
  messagesCount: number;
  unread: number;
  sentiment: Sentiment;
  health: Health;
  responseTimeMin: number;
  satisfactionScore: number; // 0-100
  tags: string[];
  summary: string;
  topics: string[];
  risks: string[];
  opportunities: string[];
  nextStep: string;
}

export const conversations: Conversation[] = [
  {
    id: "c1",
    name: "Grupo • Operação Norte",
    avatar: "ON",
    lastMessage: "Combinado, fechamos na sexta às 10h.",
    lastAt: "há 4min",
    messagesCount: 1284,
    unread: 3,
    sentiment: "positive",
    health: "healthy",
    responseTimeMin: 6,
    satisfactionScore: 87,
    tags: ["fechamento", "logística"],
    summary:
      "Cliente engajado discutindo cronograma de entrega para a operação Norte. Decisão prevista para sexta.",
    topics: ["Cronograma", "Pagamento", "SLA"],
    risks: ["Prazo apertado para emissão de NF"],
    opportunities: ["Upsell de transporte refrigerado", "Contrato anual"],
    nextStep: "Enviar proposta revisada até quinta 18h.",
  },
  {
    id: "c2",
    name: "Mariana Alves",
    avatar: "MA",
    lastMessage: "Vocês não responderam meu último e-mail.",
    lastAt: "há 32min",
    messagesCount: 214,
    unread: 7,
    sentiment: "negative",
    health: "risk",
    responseTimeMin: 142,
    satisfactionScore: 31,
    tags: ["reclamação", "churn"],
    summary:
      "Cliente demonstra frustração com falta de retorno e ameaça cancelar contrato.",
    topics: ["SLA", "Atendimento", "Cancelamento"],
    risks: ["Risco alto de churn nos próximos 7 dias"],
    opportunities: ["Oferecer crédito de retenção"],
    nextStep: "Ligação prioritária do CSM nas próximas 2h.",
  },
  {
    id: "c3",
    name: "Grupo • Vendas Sul",
    avatar: "VS",
    lastMessage: "Bati a meta do mês 🎉",
    lastAt: "há 1h",
    messagesCount: 942,
    unread: 0,
    sentiment: "positive",
    health: "healthy",
    responseTimeMin: 8,
    satisfactionScore: 92,
    tags: ["interno", "performance"],
    summary: "Time celebrando atingimento de meta. Clima positivo e produtivo.",
    topics: ["Meta", "Comissão"],
    risks: [],
    opportunities: ["Replicar playbook para Sudeste"],
    nextStep: "Documentar playbook do Sul.",
  },
  {
    id: "c4",
    name: "João Pedro – Atacadão BR",
    avatar: "JP",
    lastMessage: "Preciso de desconto pra fechar 500 unidades.",
    lastAt: "há 2h",
    messagesCount: 87,
    unread: 2,
    sentiment: "neutral",
    health: "attention",
    responseTimeMin: 22,
    satisfactionScore: 64,
    tags: ["negociação", "B2B"],
    summary: "Negociação em andamento com pedido de desconto por volume.",
    topics: ["Desconto", "Volume", "Prazo"],
    risks: ["Margem abaixo do mínimo se aceitar 12%"],
    opportunities: ["Fechar contrato trimestral"],
    nextStep: "Aprovar desconto de 8% com fidelidade 3 meses.",
  },
  {
    id: "c5",
    name: "Carla Mendes",
    avatar: "CM",
    lastMessage: "Recebi tudo certinho, obrigada!",
    lastAt: "há 3h",
    messagesCount: 41,
    unread: 0,
    sentiment: "positive",
    health: "healthy",
    responseTimeMin: 4,
    satisfactionScore: 95,
    tags: ["pós-venda"],
    summary: "Pós-venda concluído com sucesso. Cliente promotora.",
    topics: ["Entrega", "NPS"],
    risks: [],
    opportunities: ["Pedir depoimento / case"],
    nextStep: "Solicitar review no Google.",
  },
  {
    id: "c6",
    name: "Grupo • Suporte N2",
    avatar: "SN",
    lastMessage: "Subiu o hotfix em produção.",
    lastAt: "há 5h",
    messagesCount: 2310,
    unread: 12,
    sentiment: "neutral",
    health: "attention",
    responseTimeMin: 18,
    satisfactionScore: 71,
    tags: ["suporte", "técnico"],
    summary: "Time tratando 3 incidentes simultâneos. Operação sob pressão.",
    topics: ["Incidente", "Hotfix", "Postmortem"],
    risks: ["Recorrência do bug de fila"],
    opportunities: ["Automatizar rollback"],
    nextStep: "Agendar postmortem na sexta.",
  },
  {
    id: "c7",
    name: "Ricardo • Construtora Vega",
    avatar: "RV",
    lastMessage: "Pode mandar o boleto atualizado?",
    lastAt: "há 8h",
    messagesCount: 156,
    unread: 1,
    sentiment: "neutral",
    health: "healthy",
    responseTimeMin: 12,
    satisfactionScore: 78,
    tags: ["financeiro"],
    summary: "Cliente aguardando 2ª via de boleto vencido ontem.",
    topics: ["Boleto", "Vencimento"],
    risks: ["Inadimplência se não enviar hoje"],
    opportunities: [],
    nextStep: "Enviar boleto até 17h.",
  },
  {
    id: "c8",
    name: "Beatriz – RH Acme",
    avatar: "BA",
    lastMessage: "Vamos fechar parceria de treinamento?",
    lastAt: "ontem",
    messagesCount: 64,
    unread: 4,
    sentiment: "positive",
    health: "healthy",
    responseTimeMin: 25,
    satisfactionScore: 83,
    tags: ["parceria", "novo"],
    summary: "Oportunidade nova de parceria comercial em treinamento corporativo.",
    topics: ["Parceria", "Co-marketing"],
    risks: [],
    opportunities: ["MRR adicional estimado: R$ 18k"],
    nextStep: "Marcar call comercial nesta semana.",
  },
];

export const kpis = {
  totalMessages: { value: 12483, delta: 18.2 },
  activeClients: { value: 87, delta: 6.4 },
  avgResponseMin: { value: 11, delta: -22.1 },
  satisfaction: { value: 82, delta: 3.7 },
  atRisk: { value: 4, delta: 1 },
  opportunities: { value: 12, delta: 5 },
};

export const messagesPerDay = [
  { day: "Seg", in: 820, out: 612 },
  { day: "Ter", in: 940, out: 705 },
  { day: "Qua", in: 1120, out: 880 },
  { day: "Qui", in: 980, out: 760 },
  { day: "Sex", in: 1340, out: 1010 },
  { day: "Sáb", in: 410, out: 305 },
  { day: "Dom", in: 280, out: 180 },
];

export const sentimentTrend = [
  { day: "Seg", positivo: 58, neutro: 30, negativo: 12 },
  { day: "Ter", positivo: 60, neutro: 28, negativo: 12 },
  { day: "Qua", positivo: 55, neutro: 30, negativo: 15 },
  { day: "Qui", positivo: 62, neutro: 27, negativo: 11 },
  { day: "Sex", positivo: 68, neutro: 24, negativo: 8 },
  { day: "Sáb", positivo: 71, neutro: 22, negativo: 7 },
  { day: "Dom", positivo: 70, neutro: 23, negativo: 7 },
];

export const topicsBreakdown = [
  { topic: "Preço", value: 32 },
  { topic: "Suporte", value: 27 },
  { topic: "Entrega", value: 19 },
  { topic: "Produto", value: 14 },
  { topic: "Onboarding", value: 8 },
];

export interface ChatMessage {
  id: string;
  from: "client" | "team";
  author: string;
  body: string;
  at: string;
  sentiment?: Sentiment;
  flagged?: string;
}

export const sampleChat: ChatMessage[] = [
  { id: "m1", from: "client", author: "Mariana", body: "Bom dia, alguém disponível?", at: "09:02" },
  { id: "m2", from: "client", author: "Mariana", body: "Estou esperando há 3 dias por uma resposta.", at: "09:03", sentiment: "negative", flagged: "Frustração detectada" },
  { id: "m3", from: "team", author: "Equipe", body: "Oi Mariana! Bom dia, peço desculpas pela demora.", at: "09:41" },
  { id: "m4", from: "client", author: "Mariana", body: "Se não resolverem hoje vou cancelar o contrato.", at: "09:43", sentiment: "negative", flagged: "Risco de churn" },
  { id: "m5", from: "team", author: "Equipe", body: "Entendo totalmente. Já estou puxando o seu caso e te respondo em até 30min com uma solução concreta.", at: "09:45" },
  { id: "m6", from: "client", author: "Mariana", body: "Combinado. Aguardo.", at: "09:46", sentiment: "neutral" },
  { id: "m7", from: "team", author: "Equipe", body: "Mariana, conseguimos liberar o crédito de R$ 320 e prioridade no atendimento por 90 dias. Topa?", at: "10:12" },
  { id: "m8", from: "client", author: "Mariana", body: "Topo. Obrigada por resolverem rápido :)", at: "10:14", sentiment: "positive" },
];

export function getConversation(id: string) {
  return conversations.find((c) => c.id === id);
}