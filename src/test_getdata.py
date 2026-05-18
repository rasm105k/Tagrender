import unittest
from unittest.mock import Mock

import getdata


class GraphQlClientTests(unittest.TestCase):
    def test_client_posts_query_with_api_key(self):
        session = Mock()
        response = Mock()
        response.status_code = 200
        response.json.return_value = {"data": {"ok": True}}
        response.raise_for_status = Mock()
        session.post.return_value = response

        client = getdata.GraphQlClient("https://example.test/graphql", "secret", session=session)
        result = client.execute("query Test { ok }", {"first": 3})

        self.assertEqual(result, {"ok": True})
        session.post.assert_called_once()
        _, kwargs = session.post.call_args
        self.assertEqual(kwargs["params"], {"apiKey": "secret"})
        self.assertEqual(kwargs["json"]["variables"], {"first": 3})

    def test_client_raises_on_graphql_errors(self):
        session = Mock()
        response = Mock()
        response.status_code = 200
        response.json.return_value = {"errors": [{"message": "Nope"}]}
        response.raise_for_status = Mock()
        session.post.return_value = response

        client = getdata.GraphQlClient("https://example.test/graphql", "secret", session=session)

        with self.assertRaisesRegex(getdata.GraphQlError, "Nope"):
            client.execute("query Test { ok }")


class AddressMappingTests(unittest.TestCase):
    def test_hent_parcelhuse_uses_dawa_coordinates_directly(self):
        session = Mock()
        response = Mock()
        response.json.return_value = [
            {
                "id": "hus-1",
                "adressebetegnelse": "Testvej 1, 1000 København K",
                "adgangspunkt": {"koordinater": [12.57, 55.68]},
            }
        ]
        response.raise_for_status = Mock()
        session.get.return_value = response

        bbr_client = Mock()
        bbr_client.execute.return_value = {
            "BBR_Bygning": {
                "nodes": [
                    {
                        "husnummer": "hus-1",
                        "byg021BygningensAnvendelse": 120,
                        "byg041BebyggetAreal": 140,
                    }
                ]
            }
        }

        addresses = getdata.hent_parcelhuse(1, session=session, bbr_client=bbr_client)

        self.assertEqual(len(addresses), 1)
        self.assertEqual(addresses[0]["id"], "hus-1")
        self.assertEqual(addresses[0]["adresse"], "Testvej 1, 1000 København K")
        self.assertEqual(addresses[0]["lng"], 12.57)
        self.assertEqual(addresses[0]["lat"], 55.68)
        session.get.assert_called_once()
        _, kwargs = session.get.call_args
        self.assertEqual(kwargs["params"]["per_side"], 5)
        self.assertEqual(kwargs["params"]["struktur"], "mini")

    def test_hent_parcelhuse_filters_out_apartments_and_empty_lots(self):
        session = Mock()
        response = Mock()
        response.json.return_value = [
            {
                "id": "parcelhus",
                "adressebetegnelse": "Husvej 1, 1000 København K",
                "adgangspunkt": {"koordinater": [12.57, 55.68]},
            },
            {
                "id": "lejlighed",
                "adressebetegnelse": "Lejlighedsvej 2, 1000 København K",
                "adgangspunkt": {"koordinater": [12.58, 55.69]},
            },
            {
                "id": "tom-grund",
                "adressebetegnelse": "Grundvej 3, 1000 København K",
                "adgangspunkt": {"koordinater": [12.59, 55.70]},
            },
        ]
        response.raise_for_status = Mock()
        session.get.return_value = response

        bbr_client = Mock()
        bbr_client.execute.return_value = {
            "BBR_Bygning": {
                "nodes": [
                    {
                        "husnummer": "parcelhus",
                        "byg021BygningensAnvendelse": 120,
                        "byg041BebyggetAreal": 125,
                    },
                    {
                        "husnummer": "lejlighed",
                        "byg021BygningensAnvendelse": 140,
                        "byg041BebyggetAreal": 900,
                    },
                ]
            }
        }

        addresses = getdata.hent_parcelhuse(3, session=session, bbr_client=bbr_client)

        self.assertEqual([address["id"] for address in addresses], ["parcelhus"])

    def test_hent_parcelhuse_ignores_dawa_addresses_without_coordinates(self):
        session = Mock()
        response = Mock()
        response.json.return_value = [
            {
                "id": "uden-koordinater",
                "adressebetegnelse": "Ukendtvej 1, 1000 København K",
                "adgangspunkt": {},
            },
            {
                "id": "parcelhus",
                "adressebetegnelse": "Husvej 1, 1000 København K",
                "adgangspunkt": {"koordinater": [12.57, 55.68]},
            },
        ]
        response.raise_for_status = Mock()
        session.get.return_value = response

        bbr_client = Mock()
        bbr_client.execute.return_value = {
            "BBR_Bygning": {
                "nodes": [
                    {
                        "husnummer": "uden-koordinater",
                        "byg021BygningensAnvendelse": 120,
                        "byg041BebyggetAreal": 110,
                    },
                    {
                        "husnummer": "parcelhus",
                        "byg021BygningensAnvendelse": 120,
                        "byg041BebyggetAreal": 125,
                    },
                ]
            }
        }

        addresses = getdata.hent_parcelhuse(2, session=session, bbr_client=bbr_client)

        self.assertEqual([address["id"] for address in addresses], ["parcelhus"])

    def test_hent_parcelhuse_accepts_dawa_mini_x_y_coordinates(self):
        session = Mock()
        response = Mock()
        response.json.return_value = [
            {
                "id": "parcelhus",
                "betegnelse": "Husvej 1, 1000 København K",
                "x": 12.57,
                "y": 55.68,
            },
        ]
        response.raise_for_status = Mock()
        session.get.return_value = response

        bbr_client = Mock()
        bbr_client.execute.return_value = {
            "BBR_Bygning": {
                "nodes": [
                    {
                        "husnummer": "parcelhus",
                        "byg021BygningensAnvendelse": 120,
                        "byg041BebyggetAreal": 125,
                    },
                ]
            }
        }

        addresses = getdata.hent_parcelhuse(1, session=session, bbr_client=bbr_client)

        self.assertEqual(addresses[0]["adresse"], "Husvej 1, 1000 København K")
        self.assertEqual(addresses[0]["lng"], 12.57)
        self.assertEqual(addresses[0]["lat"], 55.68)

    def test_hent_parcelhuse_fetches_next_dawa_page_when_first_page_has_no_matches(self):
        session = Mock()
        first_response = Mock()
        first_response.json.return_value = [
            {
                "id": "lejlighed",
                "betegnelse": "Lejlighedsvej 2, 1000 København K",
                "x": 12.58,
                "y": 55.69,
            },
        ]
        first_response.raise_for_status = Mock()
        second_response = Mock()
        second_response.json.return_value = [
            {
                "id": "parcelhus",
                "betegnelse": "Husvej 1, 1000 København K",
                "x": 12.57,
                "y": 55.68,
            },
        ]
        second_response.raise_for_status = Mock()
        session.get.side_effect = [first_response, second_response]

        bbr_client = Mock()
        bbr_client.execute.side_effect = [
            {
                "BBR_Bygning": {
                    "nodes": [
                        {
                            "husnummer": "lejlighed",
                            "byg021BygningensAnvendelse": 140,
                            "byg041BebyggetAreal": 900,
                        },
                    ]
                }
            },
            {
                "BBR_Bygning": {
                    "nodes": [
                        {
                            "husnummer": "parcelhus",
                            "byg021BygningensAnvendelse": 120,
                            "byg041BebyggetAreal": 125,
                        },
                    ]
                }
            },
        ]

        addresses = getdata.hent_parcelhuse(1, session=session, bbr_client=bbr_client)

        self.assertEqual([address["id"] for address in addresses], ["parcelhus"])
        self.assertEqual(session.get.call_count, 2)
        self.assertEqual(session.get.call_args_list[0].kwargs["params"]["side"], 1)
        self.assertEqual(session.get.call_args_list[1].kwargs["params"]["side"], 2)


if __name__ == "__main__":
    unittest.main()
