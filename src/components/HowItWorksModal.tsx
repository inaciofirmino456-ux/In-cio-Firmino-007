import React from 'react';
import { X, DollarSign, Award, MousePointerClick, ShieldCheck, Flame } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center">
              <Flame className="w-4 h-4 fill-white" />
            </div>
            <h3 className="font-bold text-stone-900 text-sm font-mono">
              Regras & Como Funciona o Outbid.lol
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-stone-600 leading-relaxed font-sans">
          <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200/80 text-orange-900 space-y-1">
            <div className="font-bold text-sm flex items-center gap-1.5 font-mono">
              <span>Pay-to-Rank Transparente</span>
            </div>
            <p>
              O <strong>outbid.lol</strong> é um ranking público onde a posição do seu projeto é definida unicamente pelo valor do lance em dólares. Não há algoritmos secretos nem anúncios camuflados.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 flex items-center justify-center shrink-0 font-mono font-bold">
                1
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-xs">Regra do Topo (#1)</h4>
                <p className="mt-0.5 text-stone-500">
                  Para assumir o 1º lugar da tabela, o seu lance deve ser pelo menos <strong>$5 a mais</strong> do que o lance do atual líder.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 flex items-center justify-center shrink-0 font-mono font-bold">
                2
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-xs">Aumentar Lances Anteriores</h4>
                <p className="mt-0.5 text-stone-500">
                  Se você já tem um projeto listado, você só paga a <strong>diferença</strong> entre o lance novo e o lance antigo para subir de posição.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 flex items-center justify-center shrink-0 font-mono font-bold">
                3
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-xs">Critério de Desempate</h4>
                <p className="mt-0.5 text-stone-500">
                  Se dois projetos tiverem o mesmo valor de lance, o projeto cujo lance foi registrado primeiro mantém a posição superior.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 flex items-center justify-center shrink-0 font-mono font-bold">
                4
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-xs">Cliques Diretos</h4>
                <p className="mt-0.5 text-stone-500">
                  Qualquer visitante que clicar no seu link vai diretamente para o seu site ou perfil no X, gerando tráfego qualificado contínuo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-100 bg-stone-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-mono font-bold text-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
