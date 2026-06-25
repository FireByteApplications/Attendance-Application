import { useNavigate } from "react-router-dom";
import {useState, useEffect} from "react";
import { useTitle } from "../../hooks/useTitle";
import {useCsrfToken} from "../../Components/csrfHelper.jsx"
import { validateIncidentCreationForm } from "../../Utils/formValidation.js";

const apiurl = import.meta.env.VITE_API_BASE_URL;

export default function CreateIncidentsPage(){
    const csrfToken = useCsrfToken(apiurl);
    useEffect(() => {
        if (csrfToken) sessionStorage.setItem("csrf", csrfToken);
        listIncidents()    
    }, [csrfToken]);
    
    const [incDate, setIncDate] = useState("");
    const [activId, setactivId] = useState("");
    const [incDesc, setincDesc] = useState("");
    const [submitMessage, setSubmitMessage] = useState(null);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState([]);
    const [incidentsArray, setIncidentsArray] = useState([]);
    
    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitMessage(null);
        setSubmitStatus(null);
        const data = {
            Date: incDate,
            ActivID: activId,
            IncidentDescription: incDesc
        }
        if (!incDate || !activId.trim() || !incDesc.trim()) {
            setSubmitStatus("error")
            setSubmitMessage("Please fill in all fields.");
            setIsSubmitting(false)
            return;
        }
        const validated = validateIncidentCreationForm(data)
        if (validated.length != 0){
            setSubmitStatus("error");
            setSubmitMessage(validated);
            setIsSubmitting(false)
            return;
        }

        console.log(data)
        try {
            const response = await fetch(`${apiurl}/api/attendance/createIncident`, {
                method: "POST",
                credentials: 'include',
                headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf")
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setSubmitStatus("error");
                setSubmitMessage(result.message || "An error occurred, please try again later.");
                return;
            }
            setSubmitStatus("success");
            setSubmitMessage(result.message || "Incident submitted successfully.");
            setTimeout(() => {
                window.location.href = "/createincidents";
            }, 2000);

        } catch (err) {
            console.error("Submission error:", err);

            setSubmitStatus("error");
            setSubmitMessage("An error has occurred, please try again later.");

        } finally {
            setIsSubmitting(false);
        }
    }

    const listIncidents = async () => {
        try {
            const response = await fetch(`${apiurl}/api/attendance/listIncidents`, {
                method: "GET",
                credentials: 'include',
                headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf")
                }
            });
            const result = await response.json();
            if (!response.ok) {
                setSubmitStatus("error");
                setSubmitMessage(result.message || "An error occurred fetching incidents, please try again later.");
                return;
            };

            setIncidentsArray(result)
            console.log(result);

        } catch (err) {
                console.error("Error fecting incidents:", err);
                setSubmitStatus("error");
                setSubmitMessage("An error occurred has fetching incidents, please try again later.");
            }
    }
    useTitle("Incident Creation");
    return(
        <div 
            className="container justify-content-center my-4" 
            style={{ minheight: '100vh' }}>
            {submitMessage && (
                <div
                    className={`alert ${
                    submitStatus === "success" ? "alert-success" : "alert-danger"
                    }`}
                    role="alert"
                >
                    {Array.isArray(submitMessage) ? (
                    <ul className="mb-0">
                        {submitMessage.map((message, index) => (
                        <li key={index}>{message}</li>
                        ))}
                    </ul>
                    ) : (
                    submitMessage
                    )}
                </div>
            )}
            <div 
                className="card shadow-sm m-5 d-flex"
                style={{width: '90%'}}
            >
                <div
                    className="card-body pt-4 px-4"
                >  
                    <h4 className="card-title mb-4 text-center">Create Incident</h4>
                    <div className="mb-3 mt-3 text-center">
                        <label 
                            htmlFor="incidentDateInput" 
                            className="form-label">
                            <span style={{fontSize:"25px"}}>
                                Date:
                            </span>
                        </label> 
                        
                        <input 
                            id="incidentDateInput" 
                            type="date" 
                            className="form-control"
                            onChange={(e) => setIncDate(e.target.value)}
                        />
                    </div>
                    <div className="mb-3 mt-5 text-center">
                        <label 
                            htmlFor="activIdInput" 
                            className="form-label">
                            <span style={{fontSize:"25px"}}>
                                Activ ID:
                            </span>
                        </label> 
                        
                        <input
                            id="activIdInput" 
                            type="text" 
                            className="form-control"
                            placeholder="Activ Incident ID"
                            onChange={(e) => setactivId(e.target.value)}
                        />
                    </div>
                    <div className="mt-5 mb-3 text-center">
                        <label 
                            htmlFor="descriptionInput" 
                            className="form-label">
                            <span style={{fontSize:"25px"}}>
                                Description:
                            </span>
                        </label> 
                        
                        <textarea 
                            id="descriptionInput" 
                            className="form-control text-start"
                            rows="3"
                            placeholder="Enter a short description for the incident"
                            style={{ height: "100px", resize: "none"}}
                            onChange={(e) => setincDesc(e.target.value)}
                        />
                    </div>
                    <div className="text-center">
                        <button 
                            className="btn btn-secondary"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            >
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </button>
                    </div>
                </div>
            </div>
            <div className="card shadow-sm m-5 d-flex" 
                style={{width: "90%"}} >
                <div className="card-body p-4">
                    <h4 className="card-title mb-4 text-center">Incidents</h4>
                    <div className="table-responsive">
                        <table id="incidentTbl" className="table table-striped table-hover align-middle mb-0" >
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Incident ID</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incidentsArray.map((incidentsArray, index) => (
                                    <tr key={index}>
                                        <td>{incidentsArray.incidentDate}</td>
                                        <td>{incidentsArray.incidentNumber}</td>
                                        <td>{incidentsArray.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div >
    );
}