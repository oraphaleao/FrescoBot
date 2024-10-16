class Utils {
    static formatDuration(input) {
        let ms;
    
        // Verifica se o input é um número e decide se deve tratar como segundos ou milissegundos
        if (input >= 1000) {
            ms = input; // input em milissegundos
        } else {
            ms = input * 1000; // input em segundos, converte para milissegundos
        }
    
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));
    
        let formattedDuration = '';
    
        // Formata a duração incluindo horas, se necessário
        if (hours > 0) {
            formattedDuration += `${hours}:`;
        }
        
        formattedDuration += `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
        return formattedDuration;
    }
}

module.exports = Utils