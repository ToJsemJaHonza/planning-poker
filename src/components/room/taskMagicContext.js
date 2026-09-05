import { createContext, useContext } from 'react';

export const TaskMagicContext = createContext({ burst: () => {}, snapping: false });
export const useTaskMagic = () => useContext(TaskMagicContext);
