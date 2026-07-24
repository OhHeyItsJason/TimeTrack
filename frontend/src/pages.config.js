import History from './pages/History';
import Home from './pages/Home';
import Invoices from './pages/Invoices';
import InvoiceHistoryRedirect from './pages/InvoiceHistoryRedirect';
import Settings from './pages/Settings';
import Timer from './pages/Timer';
import __Layout from './Layout.jsx';


export const PAGES = {
    "History": History,
    "Home": Home,
    "Invoice": Invoices,
    "InvoiceHistory": InvoiceHistoryRedirect,
    "Settings": Settings,
    "Timer": Timer,
}

export const pagesConfig = {
    mainPage: "Timer",
    Pages: PAGES,
    Layout: __Layout,
};
