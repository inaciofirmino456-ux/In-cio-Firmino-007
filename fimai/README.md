# FIRMI AI

**FIRMI AI** é o novo motor de treino de modelos de IA deste repositório.

Ele é inspirado na arquitetura do Higgsfield open-source, mas foi separado do TopBid para não misturar a aplicação de leilões com a infraestrutura de IA.

## Objetivos

- treino distribuído com PyTorch;
- suporte a uma ou várias GPUs;
- configuração por Python/TOML, sem YAML obrigatório;
- experiências reproduzíveis;
- checkpoints locais;
- preparação para FSDP/DeepSpeed;
- execução por `torchrun`;
- evolução futura para treino/fine-tuning de modelos de imagem e vídeo.

## Estado atual

Esta é a **primeira base modernizada**. Ainda não é um serviço de geração de vídeo e não inclui GPUs. O próximo passo é ligar um modelo open-source de vídeo/imagem e testar numa GPU cloud.

## Estrutura

```
fimai/
  pyproject.toml
  Dockerfile
  src/firmai/
    __init__.py
    config.py
    experiment.py
    checkpoint.py
    distributed.py
    cli.py
```

## Instalação

```bash
pip install -e ./fimai
```

Para PyTorch com CUDA, instale a versão adequada ao servidor GPU antes de instalar o FIRMI AI.

## Executar

```bash
python -m firmai.cli doctor
```

Treino distribuído:

```bash
torchrun --standalone --nproc_per_node=2 -m firmai.cli train
```

> O comando de treino é um esqueleto seguro para validar o ambiente. Nenhum modelo pesado é baixado automaticamente.

## Próxima fase

1. teste em GPU;
2. integrar um modelo pequeno;
3. adicionar FSDP moderno;
4. checkpoints/resume;
5. adicionar modelo de vídeo;
6. API para servir o modelo.
