// Auth store - JWT state persisted in localStorage
import { browser } from '$app/environment';

export interface Student {
    student_id: string;
    full_name: string;
    department: string;
    batch: string;
    avatar_seed: string;
    role: 'student' | 'admin';
}

export interface AuthState {
    token: string | null;
    student: Student | null;
}

function createAuthStore() {
    // grab stored token/student on init if in browser
    let token = $state<string | null>(
        browser ? localStorage.getItem('token') : null
    );
    let student = $state<Student | null>(
        browser
            ? (() => {
                try {
                    // try to parse stored student data
                    const s = localStorage.getItem('student');
                    return s ? JSON.parse(s) : null;
                } catch {
                    // corrupted data, ignore
                    return null;
                }
            })()
            : null
    );

    return {
        get token() {
            return token;
        },
        get student() {
            return student;
        },
        get isLoggedIn() {
            return !!token && !!student;
        },
        get isAdmin() {
            return student?.role === 'admin';
        },
        login(t: string, s: Student) {
            token = t;
            student = s;
            if (browser) {
                localStorage.setItem('token', t);
                localStorage.setItem('student', JSON.stringify(s));
            }
        },
        logout() {
            token = null;
            student = null;
            if (browser) {
                localStorage.removeItem('token');
                localStorage.removeItem('student');
            }
        }
    };
}

export const auth = createAuthStore();
