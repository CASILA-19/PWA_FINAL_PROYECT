/**
 * photo.js — Acceso a cámara y captura de fotos
 */

document.addEventListener('DOMContentLoaded', () => {
    const btnCamara    = document.getElementById('btnCamara');
    const btnFoto      = document.getElementById('btnFoto');
    const video        = document.getElementById('video');
    const canvas       = document.getElementById('canvas');
    const foto         = document.getElementById('foto');
    const cameraSelect = document.getElementById('cameraSelect');

    let stream = null;

    function detenerStream() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }

    btnCamara.addEventListener('click', async () => {
        try {
            detenerStream();
            const facingMode = cameraSelect.value;
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
            video.srcObject = stream;
            video.style.display  = 'block';
            btnFoto.style.display = 'inline-block';
            foto.style.display   = 'none';
            canvas.style.display = 'none';
            btnCamara.innerHTML  = '<i class="fas fa-rotate me-1"></i>Cambiar cámara';
        } catch (err) {
            showToast('No se pudo acceder a la cámara: ' + err.message, 'error');
        }
    });

    btnFoto.addEventListener('click', () => {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        foto.src           = canvas.toDataURL('image/png');
        foto.style.display = 'block';
        video.style.display  = 'none';
        btnFoto.style.display = 'none';
        btnCamara.innerHTML  = '<i class="fas fa-video me-1"></i>Abrir cámara';
        detenerStream();
        showToast('Foto capturada.', 'success');
    });
});
