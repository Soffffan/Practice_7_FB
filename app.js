// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker зарегистрирован:', registration.scope);
        } catch (err) {
            console.error('Ошибка регистрации:', err);
        }

    });
}



document.addEventListener('DOMContentLoaded', () => {
    const noteInput = document.getElementById('note-input');
    const addNoteBtn = document.getElementById('add-note-btn');
    const toggleAddBtn = document.getElementById('toggle-add-btn');
    const noteInputContainer = document.getElementById('note-input-container');
    const app = document.getElementById('app');
    const notesContainer = document.getElementById('notes-container');
    const offlineNotice = document.getElementById('offline-notice');

    
    window.addEventListener('online', () => offlineNotice.style.display = 'none');
    window.addEventListener('offline', () => offlineNotice.style.display = 'block');

    
    let notes = JSON.parse(localStorage.getItem('notes')) || [];
    let editingIndex = null;

    
    function renderNotes() {
        notesContainer.innerHTML = '';
        notes.forEach((note, index) => {
            const noteItem = document.createElement('div');
            noteItem.classList.add('note-item');
            noteItem.innerHTML = `
                <p>${note}</p>
                <div class="icon-container">
                    <button class="icon-btn edit-btn" onclick="editNote(${index})">
                        <img src="icons/pen.png" alt="Редактировать">
                    </button>
                    <button class="icon-btn delete-btn" onclick="deleteNote(${index})">
                        <img src="icons/delete.png" alt="Удалить">
                    </button>
                </div>
            `;
            notesContainer.appendChild(noteItem);
        });
    }

    
    function addNote() {
        const noteText = noteInput.value.trim();
        if (noteText) {
            if (editingIndex !== null) {
                // Если редактируем, обновляем существующую заметку
                notes[editingIndex] = noteText;
                editingIndex = null;
            } else {
                // Иначе добавляем новую заметку
                notes.push(noteText);
            }
            localStorage.setItem('notes', JSON.stringify(notes));
            noteInput.value = '';
            renderNotes();
            app.style.display = 'none';
        }
    }

    
    window.deleteNote = function(index) {
        notes.splice(index, 1);
        localStorage.setItem('notes', JSON.stringify(notes));
        renderNotes();
    }

    
    window.editNote = function(index) {
        noteInput.value = notes[index];
        editingIndex = index;
        app.style.display = 'block';
    }

    
    addNoteBtn.addEventListener('click', addNote);

    
    toggleAddBtn.addEventListener('click', () => {
        if (app.style.display === 'none') {
            app.style.display = 'block';
        } else {
            app.style.display = 'none';
        }
    });

    
    renderNotes();
});
