# ReforçoIA

Tutor inteligente de programação baseado no **Método Socrático** e no **aprendizado guiado**.

IAs genéricas entregam o código pronto e eliminam a reflexão crítica do estudante. O ReforçoIA faz o contrário: o aluno envia o código e a mensagem de erro do terminal, e o tutor responde com perguntas, dicas e conceitos em **3 níveis de ajuda**, sem entregar a solução.

> Projeto da disciplina de Algoritmos e Programação de Computadores (CIC0004), tema "IA no Aprendizado de Programação".

## Visão do produto

| | |
|---|---|
| **Problema** | IAs genéricas entregam o código pronto e o aluno deixa de refletir. |
| **Solução** | Tutor socrático com perguntas direcionadas e suporte escalonado em 3 níveis. |
| **Impacto** | Desenvolvimento do raciocínio autônomo de depuração e fixação conceitual. |

## Como funciona

1. **Recepção de dados:** o aluno envia o código-fonte e a mensagem do terminal.
2. **Prompt restritivo:** a IA é instruída a nunca enviar código corrigido. Uma segunda barreira remove blocos de código que escapem.
3. **Filtro de nível:** o servidor só devolve o que o nível de ajuda ativo permite.
4. **Resposta:** a API devolve um JSON já filtrado, pronto para ser exibido.

| Nível | Conteúdo liberado |
|---|---|
| 1 | Pergunta socrática |
| 2 | Pergunta + dica conceitual |
| 3 | Pergunta + dica + aprofundamento teórico |

A IA gera as três camadas de uma vez e o servidor as guarda na sessão. Subir de nível não faz nova chamada à IA, e o conteúdo dos níveis ainda não liberados nunca sai do servidor.

## Estrutura do repositório

```
ReforcoIA/
├── backend.py          # API (FastAPI) + integração com o Gemini
├── requirements.txt    # dependências Python
├── .env.example        # modelo de configuração (sem segredos)
├── .gitignore          # impede o envio do .env
└── README.md
```

## Como rodar

Requisitos: Python 3.10 ou superior e uma chave gratuita do Gemini.

```bash
# 1. Clonar
git clone https://github.com/RenanF-Dev/ReforcoIA.git
cd ReforcoIA

# 2. Ambiente virtual (recomendado)
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 3. Dependências
python -m pip install -r requirements.txt

# 4. Configurar a chave da IA
cp .env.example .env               # Windows: copy .env.example .env
# abra o .env e cole sua chave em GEMINI_API_KEY

# 5. Subir o servidor
python -m uvicorn backend:app --port 8000
```

- Verificação: <http://localhost:8000/api/saude> deve mostrar `"ia_configurada": true`.
- Documentação interativa (Swagger): <http://localhost:8000/docs>
- Depois de editar o `.env`, reinicie o servidor (`Ctrl+C` e suba de novo).

## Configuração (.env)

```
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-3.8-flash
GEMINI_MODEL_RESERVA=gemini-3.5-flash-lite
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GEMINI_API_KEY` | Sim | Chave gerada no [Google AI Studio](https://aistudio.google.com/apikey) (plano gratuito). |
| `GEMINI_MODEL` | Não | Modelo principal. Os nomes mudam com frequência: se der erro 404, troque aqui. |
| `GEMINI_MODEL_RESERVA` | Não | Modelo usado se o principal falhar. |

O `.env` **não é versionado**. Se uma chave for exposta por engano, apague-a no AI Studio e gere outra.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/saude` | Status do servidor e se a IA está configurada |
| POST | `/api/sessoes` | Analisa código + erro e cria uma sessão |
| GET | `/api/sessoes/{id}` | Consulta a sessão (já filtrada pelo nível) |
| PUT | `/api/sessoes/{id}/nivel` | Define o nível de ajuda (1 a 3) |
| POST | `/api/sessoes/{id}/aumentar-nivel` | Sobe um nível (máximo 3) |
| POST | `/api/sessoes/{id}/resolvido` | Marca o bug como resolvido |

Exemplo de requisição:

```json
POST /api/sessoes
{
  "codigo": "def media(n):\n    s = 0\n    for i in range(len(n) + 1):\n        s += n[i]\n    return s / len(n)",
  "erro_terminal": "IndexError: list index out of range",
  "linguagem": "auto",
  "nivel_ajuda": 1
}
```

O campo `linguagem` vale `"auto"` por padrão: a IA identifica a linguagem pelo código. O `erro_terminal` é opcional, e sem ele a IA analisa o código por conta própria.

Exemplo de resposta (nível 1):

```json
{
  "id_sessao": 1,
  "nivel_ajuda": 1,
  "resposta_ia": {
    "pergunta_socratica": "Você sabe qual é o último índice válido de uma lista com 3 elementos e até que número o seu `range` está tentando chegar?",
    "dica_conceitual": "",
    "aprofundamento": ""
  },
  "bug_resolvido": false
}
```

### Códigos de erro

| Código | Significado |
|---|---|
| 404 | Sessão inexistente |
| 422 | Dados inválidos (código vazio ou grande demais) |
| 502 | Falha ao consultar a IA (sobrecarga, tempo esgotado, resposta inválida) |
| 503 | Servidor sem `GEMINI_API_KEY` configurada |

## Robustez da integração com a IA

- **Limite de tempo:** cada chamada ao Gemini desiste após 30 segundos.
- **Novas tentativas:** erros temporários (503, 504 e 429) são repetidos com espera entre as tentativas.
- **Modelo reserva:** se o principal continuar falhando, o backend tenta o `GEMINI_MODEL_RESERVA`.
- **Resposta validada:** se a IA devolver JSON inválido ou sem a pergunta socrática, a chamada é repetida.
- **Proteção contra injeção:** o código do aluno é tratado como dado, e instruções escritas em comentários ou mensagens de erro são ignoradas.
- **Limites de tamanho:** código até 20.000 caracteres e erro até 5.000.

## Modelo de dados

```python
class SessaoTutor:
    id_sessao: int
    codigo_aluno: str
    erro_terminal: str
    linguagem: str          # "auto" = a IA identifica
    nivel_ajuda: int        # 1:Pergunta, 2:Dica, 3:Conceito
    resposta_ia: RespostaIA # pergunta_socratica, dica_conceitual, aprofundamento
    bug_resolvido: bool
```

As sessões ficam em memória e são perdidas ao reiniciar o servidor.

## Testes realizados

| Teste | Resultado |
|---|---|
| `GET /api/saude` com a chave configurada | `ia_configurada: true` |
| `POST /api/sessoes`: `IndexError` em Python (nível 1) | 200, pergunta socrática sem entregar a solução |
| `POST /api/sessoes`: `TypeError` com `input()` em Python (nível 1) | 200, a IA se adaptou ao novo erro |
| `POST /api/sessoes`: `TypeError` em JavaScript (níveis 2 e 3) | 200, camadas liberadas conforme o nível pedido |
| `POST /api/sessoes/{id}/aumentar-nivel` (2 para 3) | `aprofundamento` liberado, sem nova chamada à IA |
| `PUT /api/sessoes/{id}/nivel` (1, 2 e 3) | Conteúdo escondido e liberado de acordo com o nível; os textos se mantêm entre as trocas |
| Conteúdo das respostas | Nenhuma camada trouxe o código corrigido |
| Falha do modelo principal (504) | O backend passou ao modelo reserva e respondeu |
| `git status` | `.env` fora da lista de arquivos a versionar |

Ainda não testados: `aumentar-nivel` com a sessão já no nível 3, os erros 404 (sessão inexistente) e 422 (código vazio), além de outras linguagens.

## Planejamento

| Etapa | Entregáveis | Status |
|---|---|---|
| Sprint 1: Especificação | Visão do produto, protótipo de interface e repositório Git documentado | Concluído |
| Etapa 2: Algoritmo & IA | Backend, integração com a IA e documentação dos commits no Git | Em andamento |
| Etapa 3: Refinamento & Entrega | Ajustes finais de UI, validação pedagógica do prompt e documentação final | Planejado |

## Limitações conhecidas

- Sessões em memória (sem banco de dados).
- Sem autenticação; CORS aberto para desenvolvimento. Restrinja `allow_origins` antes de publicar.
- A qualidade das perguntas depende do modelo de IA e do plano gratuito, com limites de uso por minuto e por dia.
- Os nomes dos modelos do Gemini mudam com frequência e podem exigir ajuste em `GEMINI_MODEL`.

## Uso de IA no desenvolvimento

Este projeto foi desenvolvido com apoio do Claude (Anthropic) como assistente de programação.

**Onde a IA ajudou**
- Estrutura inicial do backend em FastAPI, a partir do protótipo da Sprint 1.
- Redação do prompt restritivo e da camada que remove código das respostas.
- Integração com a API do Gemini, incluindo tratamento de erros, novas tentativas e modelo reserva.
- Rascunho do README, dos arquivos de configuração e dos slides da Etapa 2.

**O que foi feito pelo autor**
- Definição do problema, da visão do produto e dos 3 níveis de ajuda (Sprint 1).
- Configuração do ambiente, geração da chave e execução dos testes.
- Revisão do código e das respostas da IA, e as decisões do projeto, como usar o Gemini no plano gratuito e remover os exemplos prontos para trabalhar com erros reais.

O código foi lido e testado pelo autor antes de ser incluído no repositório.
