@echo off
echo Setting up frontend folder structure...

REM Create folders
mkdir src
mkdir src\api
mkdir src\components
mkdir src\components\Dashboard
mkdir src\components\Orders
mkdir src\components\Payment
mkdir src\components\common
mkdir src\pages
mkdir src\context
mkdir src\hooks
mkdir src\utils

REM Create files
type nul > src\api\axiosConfig.js
type nul > src\api\orderAPI.js
type nul > src\api\paymentAPI.js

type nul > src\components\Dashboard\DashboardOverview.js
type nul > src\components\Dashboard\StatsCards.js
type nul > src\components\Dashboard\RecentOrders.js

type nul > src\components\Orders\OrderList.js
type nul > src\components\Orders\OrderDetails.js

type nul > src\components\Payment\PaymentForm.js
type nul > src\components\Payment\PhonePeStatus.js
type nul > src\components\Payment\QRCodeModal.js

type nul > src\components\common\Navbar.js
type nul > src\components\common\Sidebar.js
type nul > src\components\common\Loader.js
type nul > src\components\common\Toast.js

type nul > src\pages\Dashboard.js
type nul > src\pages\Orders.js
type nul > src\pages\Payment.js
type nul > src\pages\NotFound.js

type nul > src\context\AuthContext.js
type nul > src\context\OrderContext.js

type nul > src\hooks\useFetch.js
type nul > src\hooks\usePayment.js

type nul > src\utils\constants.js
type nul > src\utils\formatter.js
type nul > src\utils\phonePeUtils.js

type nul > src\App.js
type nul > src\main.jsx

echo All folders and files created successfully!
pause