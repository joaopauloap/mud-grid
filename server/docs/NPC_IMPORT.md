# Importação de NPC via JSON

## Visão Geral

É possível importar um NPC completo — incluindo nome, posição, árvore de diálogo, nós, condições, flags e ações — a partir de um arquivo **JSON**.

Isso permite criar NPCs complexos sem precisar usar os comandos interativos um por um.

---

## Como Usar

### 1. Criar o arquivo JSON

Crie um arquivo `.json` dentro do diretório:

```
server/data/npcs/
```

Exemplo: `server/data/npcs/meu_npc.json`

### 2. Executar o comando no jogo

Com role **admin**, digite no chat do jogo:

```
/npc import meu_npc.json
```

Você também pode omitir a extensão:

```
/npc import meu_npc
```

> ⚠️ O nome do NPC **não pode** conflitar com um NPC já existente. Delete o existente com `/npc delete <nome>` primeiro se necessário.

---

## Estrutura do JSON

```json
{
  "name": "NomeDoNPC",
  "x": 0,
  "y": 0,
  "dialogTree": {
    "name": "NomeDaArvore",
    "nodes": [
      {
        "trigger": "oi",
        "response": "Olá, aventureiro!",
        "hint": "Dica para o jogador",
        "flags": "greeting,goodbye",
        "sortOrder": 0,
        "condition": {
          "type": "has_item",
          "value": "chave"
        },
        "actions": [
          {
            "type": "give_item",
            "keyword": "espada",
            "name": "Espada Lendária",
            "description": "Uma espada que brilha com luz própria."
          }
        ],
        "children": [
          {
            "trigger": "missao",
            "response": "Sua missão é derrotar o chefão.",
            "flags": "quest_start"
          }
        ]
      }
    ]
  }
}
```

---

## Campos do NPC (nível raiz)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | `string` | ✅ Sim | Nome único do NPC |
| `x` | `number` | ❌ Não | Coordenada X (padrão: `0`) |
| `y` | `number` | ❌ Não | Coordenada Y (padrão: `0`) |
| `dialogTree` | `object` | ❌ Não | Árvore de diálogo completa (veja abaixo) |

---

## Campos da Árvore de Diálogo (`dialogTree`)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | `string` | ✅ Sim | Nome identificador da árvore |
| `nodes` | `array` | ❌ Não | Lista de nós raiz da árvore |

---

## Campos de um Nó de Diálogo (`nodes[]`)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `trigger` | `string` | ✅ Sim | Palavra-chave que o jogador deve digitar para ativar este nó |
| `response` | `string` | ✅ Sim | Resposta que o NPC dará ao jogador |
| `hint` | `string` | ❌ Não | Dica exibida ao jogador sobre o que pode perguntar |
| `flags` | `string` ou `array` | ❌ Não | Flags do nó. Pode ser string `"greeting,goodbye"` ou array `["greeting", "goodbye"]` |
| `sortOrder` | `number` | ❌ Não | Ordem de exibição entre nós irmãos (padrão: `0`) |
| `condition` | `object` | ❌ Não | Condição para o nó ficar visível (veja abaixo) |
| `actions` | `array` | ❌ Não | Lista de ações executadas ao ativar o nó (veja abaixo) |
| `children` | `array` | ❌ Não | Lista de nós filhos (sub-diálogos). Mesma estrutura que `nodes[]` |

### Flags disponíveis

| Flag | Descrição |
|------|-----------|
| `greeting` | Nó executado automaticamente quando o jogador inicia conversa |
| `goodbye` | Finaliza a conversa após executar este nó |
| `quest_start` | Marca o início de uma quest |
| `quest_complete` | Marca a conclusão de uma quest |

---

## Condição (`condition`)

Permite que um nó só seja ativado se o jogador atender a um requisito.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `type` | `string` | ✅ Sim | Tipo da condição. Valores: `has_item`, `has_role`, `quest_flag` |
| `value` | `string` | ✅ Sim | Valor a verificar (keyword do item, nome do role, ou nome da flag) |

### Tipos de condição

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `has_item` | Jogador possui o item no inventário | `{ "type": "has_item", "value": "disco" }` |
| `has_role` | Jogador possui o role (cargo) | `{ "type": "has_role", "value": "admin" }` |
| `quest_flag` | Jogador possui a flag de quest | `{ "type": "quest_flag", "value": "missao_iniciada" }` |

---

## Ações (`actions[]`)

Cada ação é um objeto com `type` obrigatório e parâmetros específicos.

### Tipos de Ação

#### `give_item` — Dar um item ao jogador

```json
{
  "type": "give_item",
  "keyword": "espada",
  "name": "Espada Lendária",
  "description": "Uma espada reluzente."
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `keyword` | `string` | ✅ Sim | Palavra-chave para referenciar o item |
| `name` | `string` | ❌ Não | Nome do item (padrão: mesmo valor de `keyword`) |
| `description` | `string` | ❌ Não | Descrição do item (padrão: string vazia) |

#### `remove_item` — Remover um item do jogador

```json
{
  "type": "remove_item",
  "keyword": "chave"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `keyword` | `string` | ✅ Sim | Keyword do item a ser removido |

#### `teleport` — Teleportar o jogador

```json
{
  "type": "teleport",
  "x": 5,
  "y": 3
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `x` | `number` | ✅ Sim | Coordenada X de destino |
| `y` | `number` | ✅ Sim | Coordenada Y de destino |

#### `broadcast` — Enviar mensagem pública

```json
{
  "type": "broadcast",
  "message": "O Guardião anunciou: A prova começou!"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `message` | `string` | ✅ Sim | Mensagem enviada para todos os jogadores online |

---

## Exemplo Completo

```json
{
  "name": "Mestre dos Magos",
  "x": 3,
  "y": 5,
  "dialogTree": {
    "name": "ArvoreMestre",
    "nodes": [
      {
        "trigger": "oi",
        "response": "Saudações, jovem mago. O que deseja?",
        "flags": "greeting",
        "hint": "Pergunte sobre magia, missão ou itens",
        "children": [
          {
            "trigger": "magia",
            "response": "A magia flui em todos nós. Treine e descobrirá seu potencial.",
            "hint": "Pergunte sobre itens ou missão"
          },
          {
            "trigger": "missao",
            "response": "Preciso que você recupere o Cristal de Fogo na caverna (5, 3).",
            "flags": "quest_start",
            "actions": [
              {
                "type": "give_item",
                "keyword": "mapa_caverna",
                "name": "Mapa da Caverna",
                "description": "Um mapa antigo mostrando a entrada da caverna."
              }
            ],
            "condition": {
              "type": "has_role",
              "value": "user"
            },
            "children": [
              {
                "trigger": "sim",
                "response": "Boa sorte! Volte quando tiver o cristal.",
                "flags": "goodbye"
              },
              {
                "trigger": "nao",
                "response": "Então volte quando estiver pronto.",
                "flags": "goodbye"
              }
            ]
          },
          {
            "trigger": "itens",
            "response": "Aceite esta poção como cortesia.",
            "actions": [
              {
                "type": "give_item",
                "keyword": "pocao_vida",
                "name": "Poção de Vida",
                "description": "Uma poção vermelha que restaura energia."
              }
            ]
          }
        ]
      },
      {
        "trigger": "tchau",
        "response": "Até logo, aprendiz!",
        "flags": "goodbye"
      }
    ]
  }
}
```

---

## Dicas

- **Sem dialogTree**: se o JSON não tiver o campo `dialogTree`, apenas o NPC será criado (útil para NPCs decorativos ou de suporte).
- **Sem nodes**: se `dialogTree` existir mas `nodes` estiver vazio, a árvore é criada sem nós (você pode adicioná-los depois com `/npc tree`).
- **Condição e ações**: podem ser combinadas no mesmo nó.
- **Árvore aninhada**: use `children` para criar diálogos ramificados (sub-tópicos que o jogador pode explorar).
- **sortOrder**: controla a ordem em que os nós filhos aparecem para o jogador; nós com sortOrder menor aparecem primeiro.
