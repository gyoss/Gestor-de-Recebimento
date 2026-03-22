import React, { useState } from 'react';
import { Divergence, DivergenceStatus } from '../types';
import { DivergenceCard } from './DivergenceCard';
import { COLUMNS } from '../constants';
import { MoreHorizontal, Plus, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { OperationType, handleFirestoreError } from '../firebase';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'motion/react';

interface KanbanBoardProps {
  divergences: Divergence[];
  onAddCard: () => void;
  onEditCard: (divergence: Divergence) => void;
  onDeleteCard: (id: string) => void;
  onMoveCard: (id: string, status: DivergenceStatus) => void;
  columns?: typeof COLUMNS;
  showAddButton?: boolean;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  divergences, 
  onAddCard, 
  onEditCard, 
  onDeleteCard, 
  onMoveCard,
  columns = COLUMNS,
  showAddButton = true
}) => {
  const [confirmMove, setConfirmMove] = useState<{ id: string; status: DivergenceStatus; title: string } | null>(null);
  const DraggableComponent = Draggable as any;
  const DroppableComponent = Droppable as any;

  const handleMoveConfirm = async () => {
    if (!confirmMove) return;
    try {
      await onMoveCard(confirmMove.id, confirmMove.status);
      setConfirmMove(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `divergences/${confirmMove.id}`);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const divergence = divergences.find(d => d.id === draggableId);
    if (!divergence) return;

    const newStatus = destination.droppableId as DivergenceStatus;
    const columnTitle = COLUMNS.find(c => c.id === newStatus)?.title || newStatus;

    setConfirmMove({
      id: draggableId,
      status: newStatus,
      title: columnTitle
    });
  };

  const moveCard = (id: string, newStatus: DivergenceStatus) => {
    const divergence = divergences.find(d => d.id === id);
    if (!divergence) return;

    const columnTitle = COLUMNS.find(c => c.id === newStatus)?.title || newStatus;
    
    setConfirmMove({
      id,
      status: newStatus,
      title: columnTitle
    });
  };

  const getNextStatus = (current: DivergenceStatus): DivergenceStatus | null => {
    const currentIndex = COLUMNS.findIndex(c => c.id === current);
    if (currentIndex < COLUMNS.length - 1) return COLUMNS[currentIndex + 1].id as DivergenceStatus;
    return null;
  };

  const getPrevStatus = (current: DivergenceStatus): DivergenceStatus | null => {
    const currentIndex = COLUMNS.findIndex(c => c.id === current);
    if (currentIndex > 0) return COLUMNS[currentIndex - 1].id as DivergenceStatus;
    return null;
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex w-full h-full gap-6 overflow-x-auto pb-4 custom-scrollbar">
          {columns.map((column) => {
            const columnDivergences = divergences.filter(d => d.status === column.id);
            
            return (
              <div 
                key={column.id} 
                className="flex flex-col w-80 min-w-[320px] bg-slate-50/50 rounded-2xl border border-slate-200/60"
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-tight">
                      {column.title}
                    </h3>
                    <span className="bg-slate-200 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {columnDivergences.length}
                    </span>
                  </div>
                  <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                <DroppableComponent droppableId={column.id}>
                  {(provided: any) => (
                    <div 
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-[150px]"
                    >
                      {columnDivergences.map((divergence, index) => (
                        <DraggableComponent key={divergence.id} draggableId={divergence.id} index={index}>
                          {(provided: any, snapshot: any) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`relative group ${snapshot.isDragging ? 'z-50' : ''}`}
                            >
                              <DivergenceCard 
                                divergence={divergence} 
                                onEdit={onEditCard}
                                onDelete={onDeleteCard}
                              />
                              
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                {getPrevStatus(divergence.status) && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveCard(divergence.id, getPrevStatus(divergence.status)!);
                                    }}
                                    className="p-1 bg-white shadow-sm border border-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                                    title="Status Anterior"
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                  </button>
                                )}
                                {getNextStatus(divergence.status) && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveCard(divergence.id, getNextStatus(divergence.status)!);
                                    }}
                                    className="p-1 bg-white shadow-sm border border-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                                    title={getNextStatus(divergence.status) === 'CONCLUIDO' ? 'Concluir' : 'Próximo Status'}
                                  >
                                    {getNextStatus(divergence.status) === 'CONCLUIDO' ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <ArrowRight className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </DraggableComponent>
                      ))}
                      {provided.placeholder}
                      
                      {showAddButton && (
                        <button 
                          onClick={onAddCard}
                          className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-medium hover:border-slate-300 hover:text-slate-500 hover:bg-white transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Novo Card
                        </button>
                      )}
                    </div>
                  )}
                </DroppableComponent>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmMove && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmar Movimentação</h3>
                <p className="text-sm text-slate-500">
                  Deseja mover este card para a coluna <span className="font-bold text-slate-700">"{confirmMove.title}"</span>?
                </p>
              </div>
              <div className="flex border-t border-slate-100">
                <button
                  onClick={() => setConfirmMove(null)}
                  className="flex-1 px-4 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleMoveConfirm}
                  className="flex-1 px-4 py-4 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors border-l border-slate-100"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
