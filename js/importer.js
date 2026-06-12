/* ==========================================
   SalesFlow Excel / CSV Importer (importer.js)
   ========================================== */
import { store } from './store.js';

// Parses spreadsheet row properties into our strict database schema
export function mapRowToSchema(row, projectType) {
    const keys = Object.keys(row);
    
    // Key matcher targeting flexible spelling & spacing
    const getVal = (possibleHeaders) => {
        const key = keys.find(k => {
            const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            return possibleHeaders.some(h => {
                const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
                return cleanK === cleanH;
            });
        });
        return key ? row[key] : undefined;
    };

    // Standardize statuses
    const parseStatus = (val) => {
        if (!val) return 'not-started';
        const str = String(val).toLowerCase().replace(/[^a-z]/g, '');
        if (str.includes('progress') || str.includes('working') || str.includes('active')) return 'in-progress';
        if (str.includes('completed') || str.includes('done') || str.includes('won') || str.includes('installed')) return 'completed';
        if (str.includes('hold') || str.includes('paused') || str.includes('block')) return 'on-hold';
        return 'not-started';
    };

    // Standardize priorities
    const parsePriority = (val) => {
        if (!val) return 'low';
        const str = String(val).toLowerCase();
        if (str.includes('high') || str.includes('urgent') || str.includes('critical') || str.includes('red')) return 'high';
        if (str.includes('medium') || str.includes('med') || str.includes('yellow')) return 'medium';
        return 'low';
    };

    // Format serial Excel dates or standard strings to YYYY-MM-DD
    const getDateVal = (headers) => {
        const val = getVal(headers);
        if (!val) return '';
        
        if (val instanceof Date) {
            return val.toISOString().split('T')[0];
        }

        // Handle Excel date serial codes if parsed as numbers
        if (typeof val === 'number' && val > 30000) {
            try {
                // Approximate conversion if not caught by SheetJS cellDates
                const date = new Date((val - 25569) * 86400 * 1000);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            } catch (e) {
                console.error("Failed to parse numeric date:", val, e);
            }
        }

        const parsedDate = new Date(val);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().split('T')[0];
        }
        return '';
    };

    const task = {
        projectType,
        title: getVal(['project name', 'task name', 'lead name', 'client name', 'title', 'task details', 'projectname']) || 'Untitled Task',
        status: parseStatus(getVal(['status', 'lead status', 'current status', 'state'])),
        priority: parsePriority(getVal(['priority', 'importance', 'level'])),
        assignedTo: getVal(['assigned to', 'assignee', 'staff', 'owner', 'assignedto']) || 'Self',
        description: getVal(['description', 'details', 'notes', 'about', 'comments']) || '',
        followupDate: getDateVal(['followup date', 'followup', 'follow up date', 'next followup', 'follow up', 'nextactiondate']),
        hasDependency: false,
        dependencyPerson: '',
        dependencyIssue: ''
    };

    // Check for dependency / blocker fields
    const blockerVal = getVal(['blockers', 'issues', 'blocker', 'dependency', 'blockers issues', 'issues / blockers', 'blockers/issues']);
    if (blockerVal && String(blockerVal).trim()) {
        task.hasDependency = true;
        task.dependencyPerson = getVal(['assigned to', 'assignee']) || 'External Contact';
        task.dependencyIssue = String(blockerVal).trim();
    }

    // Tags list
    const tagsVal = getVal(['tags', 'tag', 'category', 'provision of tags']);
    task.tags = tagsVal ? String(tagsVal).split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

    // Digital Marketing Custom Fields
    if (projectType === 'digital-marketing') {
        task.subproject = getVal(['segregation', 'subproject', 'service', 'type', 'segregated']) || 'Website Development';
        task.clientName = getVal(['client name', 'client', 'contact name']) || '';
        task.startDate = getDateVal(['start date', 'start', 'startdate']);
        task.deadline = getDateVal(['deadline', 'due date', 'due', 'deadline date']);
        task.currentStage = getVal(['current stage', 'stage', 'currentstage']) || 'Planning';
        task.nextAction = getVal(['next action', 'action', 'next step', 'nextaction']) || '';
        
        // Include comments if any
        const commentsVal = getVal(['comments', 'comment']);
        if (commentsVal) {
            task.description += `\nComments: ${commentsVal}`;
        }
    } 
    // Nable Attendance CRM Custom Fields
    else if (projectType === 'nable-attendance') {
        task.leadStatus = getVal(['lead status', 'status', 'sales stage', 'leadstatus']) || 'Cold';
        task.installed = getVal(['installed', 'installed?', 'software installed', 'is installed', 'installed status']) || 'No';
        task.credentials = getVal(['credentials', 'login info', 'portal', 'creds']) || '';
        task.demoStage = getVal(['demo', 'demo stage', 'demo status', 'demo scheduled']) || 'None';
        task.contactPerson = getVal(['contact person', 'contact', 'phone', 'email', 'contactperson']) || '';
        task.billingDetails = getVal(['billing details', 'billing', 'price', 'pricing', 'billingdetails']) || '';
    } 
    // BNI Custom Fields
    else if (projectType === 'bni-tasks') {
        task.bniMeetingDate = getDateVal(['meeting date', 'bni date', 'assign date', 'meetingdate']);
        task.bniDeadline = getDateVal(['deadline', 'due date', 'task deadline', 'bnideadline']);
        task.bniAssignedBy = getVal(['assigned by', 'assignedby', 'member', 'assigned from']) || '';
        task.bniReferral = getVal(['referral details', 'referral', 'client', 'referral name']) || '';
    }

    return task;
}

// Read raw file buffer and parse worksheets using SheetJS
export function parseExcelFile(file, projectType, callback) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            
            // Get first worksheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert worksheet to JSON rows
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            
            if (rows.length === 0) {
                callback(new Error("Empty spreadsheet file detected."), null);
                return;
            }
            
            // Map rows to schema tasks
            const tasks = rows.map(row => mapRowToSchema(row, projectType));
            callback(null, tasks);
        } catch (error) {
            console.error("Excel parse failed:", error);
            callback(error, null);
        }
    };
    
    reader.onerror = (error) => {
        callback(error, null);
    };
    
    reader.readAsArrayBuffer(file);
}

// Saves mapped tasks back to store database
export function importTasksToStore(tasks) {
    if (!Array.isArray(tasks)) return 0;
    
    tasks.forEach(task => {
        // Direct save through store
        store.saveTask(task);
    });
    
    return tasks.length;
}
