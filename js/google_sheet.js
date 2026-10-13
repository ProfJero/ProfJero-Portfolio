const scriptURL = 'https://script.google.com/macros/s/AKfycby7IneCiKSYsTFxcX-nOIr2D_1FctQ5hPKkmlVGhmZnJQzntP-lw1-hzCu3JnJRJ0ENNA/exec'

const form = document.forms['contact-form']

form.addEventListerner('submit', e =>{
    e.preventDefault()
    fetch(scriptURL, {method: 'POST', body: new FormData(form)})
    .then(response => alert("Thank you! Your form is submitted successfully."))
    .then(() => {window.location.reload(); })
    .catch(error => console.error('Error!', error.message))
})