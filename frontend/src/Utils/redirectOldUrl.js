//redirect so app can only be accessed via azure front door
const current =
window.location.hostname
const expected = 'jrfbattendanceappfd-d7bmgfb8f6g6debw.z03.azurefd.net'
if(
    current.endsWith('.azurestaticapps.net') && current !== expected
    ){
    window.location.href = `https://${expected}`
    }