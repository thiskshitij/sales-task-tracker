/* ==========================================
   SalesFlow Store Management (store.js)
   ========================================== */

// Helper to get dates relative to today
export function getRelativeDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
}

const todayStr = getRelativeDate(0);
const tomorrowStr = getRelativeDate(1);
const yesterdayStr = getRelativeDate(-1);

// High-fidelity initial sample data
const defaultTasks = [];

class SalesStore {
    constructor() {
        this.tasks = [];
        this.init();
    }

    init() {
        const stored = localStorage.getItem('salesflow_tasks_v3');
        if (stored) {
            try {
                this.tasks = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse stored tasks, resetting...", e);
                this.tasks = [...defaultTasks];
                this.saveToStorage();
            }
        } else {
            this.tasks = [...defaultTasks];
            this.saveToStorage();
        }
    }

    saveToStorage() {
        localStorage.setItem('salesflow_tasks_v3', JSON.stringify(this.tasks));
        // Dispatch custom event to notify other modules of updates
        window.dispatchEvent(new CustomEvent('store-updated'));
    }

    getAllTasks() {
        return this.tasks;
    }

    getTasksFiltered({ projectType = 'all', priority = 'all', status = 'all', search = '' } = {}) {
        return this.tasks.filter(task => {
            // Project filter
            if (projectType !== 'all' && task.projectType !== projectType) return false;
            
            // Priority filter
            if (priority !== 'all' && task.priority !== priority) return false;
            
            // Status filter
            if (status !== 'all' && task.status !== status) return false;
            
            // Search query filter (checks title, description, clientName, contacts, tags)
            if (search.trim()) {
                const q = search.toLowerCase();
                const titleMatch = (task.title || '').toLowerCase().includes(q);
                const descMatch = (task.description || '').toLowerCase().includes(q);
                const clientMatch = (task.clientName || '').toLowerCase().includes(q);
                const contactMatch = (task.contactPerson || '').toLowerCase().includes(q);
                const tagsMatch = (task.tags || []).some(t => t.toLowerCase().includes(q));
                
                if (!titleMatch && !descMatch && !clientMatch && !contactMatch && !tagsMatch) {
                    return false;
                }
            }
            return true;
        });
    }

    getTaskById(id) {
        return this.tasks.find(t => t.id === id);
    }

    deleteTask(id) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.tasks.splice(index, 1);
            this.saveToStorage();
            return true;
        }
        return false;
    }

    saveTask(taskData) {
        const isNew = !taskData.id;
        const now = new Date();
        const timestamp = now.toLocaleDateString() + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let task = null;
        
        if (isNew) {
            task = {
                id: taskData.projectType.substring(0, 3) + "-" + Date.now(),
                history: [{ timestamp, user: "System", message: "Task captured." }],
                ...taskData
            };
            
            // Log details initially
            if (taskData.progressLog) {
                task.history.push({ timestamp, user: taskData.assignedTo || "You", message: taskData.progressLog });
            }
            delete task.progressLog;
            
            this.tasks.unshift(task);
        } else {
            task = this.tasks.find(t => t.id === taskData.id);
            if (!task) return null;
            
            // Generate audit logs for changes
            const logs = [];
            
            if (task.status !== taskData.status) {
                logs.push(`Status changed from '${task.status}' to '${taskData.status}'.`);
            }
            if (task.priority !== taskData.priority) {
                logs.push(`Priority changed from '${task.priority}' to '${taskData.priority}'.`);
            }
            if (task.followupDate !== taskData.followupDate && taskData.followupDate) {
                logs.push(`Follow-up date updated to ${taskData.followupDate}.`);
            }
            
            // Check project-specific fields
            if (taskData.projectType === 'digital-marketing') {
                if (task.currentStage !== taskData.currentStage) {
                    logs.push(`Stage updated to '${taskData.currentStage}'.`);
                }
                if (task.nextAction !== taskData.nextAction && taskData.nextAction) {
                    logs.push(`Next action updated: '${taskData.nextAction}'.`);
                }
            } else if (taskData.projectType === 'nable-attendance') {
                if (task.leadStatus !== taskData.leadStatus) {
                    logs.push(`Lead Status changed to '${taskData.leadStatus}'.`);
                }
                if (task.installed !== taskData.installed) {
                    logs.push(`Software installation status toggled to '${taskData.installed}'.`);
                }
            }
            
            if (taskData.progressLog) {
                logs.push(`Progress log added: "${taskData.progressLog}"`);
            }
            
            // Update fields
            Object.assign(task, taskData);
            delete task.progressLog;
            
            // Append change histories
            logs.forEach(msg => {
                task.history.push({ timestamp, user: taskData.assignedTo || "You", message: msg });
            });
        }
        
        this.saveToStorage();
        return task;
    }

    // Export whole store to JSON string
    exportData() {
        return JSON.stringify(this.tasks, null, 2);
    }

    // Import from JSON string (overwrites or merges)
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (Array.isArray(data)) {
                this.tasks = data;
                this.saveToStorage();
                return true;
            }
        } catch (e) {
            console.error("Failed to import tasks:", e);
        }
        return false;
    }
}

export const store = new SalesStore();
