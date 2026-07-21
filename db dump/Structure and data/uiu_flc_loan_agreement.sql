-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: uiu_flc
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `loan_agreement`
--

DROP TABLE IF EXISTS `loan_agreement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_agreement` (
  `agreement_id` int(11) NOT NULL AUTO_INCREMENT,
  `loan_id` int(11) NOT NULL,
  `offer_id` int(11) NOT NULL,
  `borrower_id` int(11) NOT NULL,
  `lender_id` int(11) NOT NULL,
  `principal_amount` float NOT NULL,
  `interest_rate` float DEFAULT NULL,
  `total_payable` float DEFAULT NULL,
  `agreed_conditions` text DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `repayment_status` enum('pending','partial','completed','defaulted') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`agreement_id`),
  KEY `loan_id` (`loan_id`),
  KEY `offer_id` (`offer_id`),
  KEY `borrower_id` (`borrower_id`),
  KEY `lender_id` (`lender_id`),
  CONSTRAINT `loan_agreement_ibfk_1` FOREIGN KEY (`loan_id`) REFERENCES `loan_request` (`loan_id`) ON DELETE CASCADE,
  CONSTRAINT `loan_agreement_ibfk_2` FOREIGN KEY (`offer_id`) REFERENCES `loan_offer` (`offer_id`) ON DELETE CASCADE,
  CONSTRAINT `loan_agreement_ibfk_3` FOREIGN KEY (`borrower_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `loan_agreement_ibfk_4` FOREIGN KEY (`lender_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loan_agreement`
--

LOCK TABLES `loan_agreement` WRITE;
/*!40000 ALTER TABLE `loan_agreement` DISABLE KEYS */;
/*!40000 ALTER TABLE `loan_agreement` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-31 23:53:10
